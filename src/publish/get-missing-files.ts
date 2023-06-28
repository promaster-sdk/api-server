import path from "path";
// import fs from "fs";
import fsp from "fs/promises";
// import { promisify } from "util";
import { withSpan } from "../tracing";

// const readFileAsync = promisify(fs.readFile);
// const renameAsync = promisify(fs.rename);
// const unlinkAsync = promisify(fs.unlink);
//const readDirAsync = promisify(fs.readdir);

interface FileWithRefs {
  readonly refs?: { readonly [key: number]: string };
}

interface MissingFilesResult {
  readonly missingFiles: ReadonlyArray<string>;
  readonly referencedFiles: ReadonlyArray<string>;
}

export async function getMissingFilesForRootFiles(
  filesPath: string,
  fileNames: ReadonlyArray<string>,
  saveQueryParam: string,
  tempFileSuffix: string,
  readFilesInParallel: number,
  pruneFiles: boolean,
  onPublishComplete: () => Promise<void>
): Promise<ReadonlyArray<string>> {
  return await withSpan("getMissingFilesForRootFiles", async (_span) => {
    // Get the directory listing once so we don't need to do I/O calls for each file to check if exists
    const existingFiles = await getExistingFiles(filesPath);

    // console.time("getMissingFilesRecursive");
    const stats = { readFiles: 0 };
    const missingFilesResult = await getMissingFilesRecursive(
      filesPath,
      existingFiles,
      fileNames,
      0,
      stats,
      readFilesInParallel
    );
    // console.timeEnd("getMissingFilesRecursive");
    // console.log("getMissingFilesRecursive stats", stats);

    // The uploaded files are always stored on disk but have temp file names so they are not "saved" yet.
    // Handle the save parameter, delete or rename the temp-files
    // This handling only apply to root.json
    if (saveQueryParam === "ifcomplete" && missingFilesResult.missingFiles.length === 0) {
      // In this case the publish is complete and should be commited (overwrite root.json file)
      // Rename temp-files ("save" them)
      const referencedFiles = new Set(missingFilesResult.referencedFiles);
      const renamePromises = fileNames.map((file) => {
        const newName = file.substr(0, file.length - tempFileSuffix.length);
        // Rename in our sets
        referencedFiles.delete(file);
        referencedFiles.add(newName);
        existingFiles.delete(file);
        existingFiles.add(newName);
        // Rename on disk
        const oldFullPath = path.join(filesPath, file);
        const newFullPath = path.join(filesPath, newName);
        return fsp.rename(oldFullPath, newFullPath);
      });
      await Promise.all(renamePromises);
      // Prune (delete unused files)
      if (pruneFiles) {
        const pruneFiles = difference(existingFiles, referencedFiles);
        const prunePromises = Array.from(pruneFiles).map((file) => fsp.unlink(path.join(filesPath, file)));
        await Promise.all(prunePromises);
      }

      await onPublishComplete()
    } else if (saveQueryParam === "no") {
      // Delete the temp-files instead of renamnign them (do not "save" them)
      // One use-case for save=no is when checking update-to-date status from promaster-edit by
      // posting root.json and checking if any missing files are returned.
      const promises = fileNames.map((file) => fsp.unlink(path.join(filesPath, file)));
      await Promise.all(promises);
    }

    return missingFilesResult.missingFiles;
  });
}

async function getExistingFiles(path: string): Promise<Set<string>> {
  return await withSpan("getExistingFiles", async (_span) => {
    // const existingFilesArray = await fsp.readdir(path);
    const existingFilesSet = new Set<string>();
    const dir = await fsp.opendir(path, { bufferSize: 100 });
    for await (const dirent of dir) {
      existingFilesSet.add(dirent.name);
    }
    //const existingFilesSet = new Set(existingFilesArray);
    return existingFilesSet;
  });
}

/**
 * This function recursively check for missing files.
 */
async function getMissingFilesRecursive(
  filePath: string,
  existingFiles: Set<string>,
  fileNames: ReadonlyArray<string>,
  level: number,
  // tslint:disable-next-line:readonly-keyword
  stats: { readFiles: number },
  readFilesInParallel: number
): Promise<MissingFilesResult> {
  return await withSpan("getMissingFilesRecursive", async (span) => {
    if (level > 10) {
      throw new Error("Too deep recursion while checking for missing files.");
    }

    // For each file we got there can be three cases:
    // 1. It exists and have references (json files) -> check refs recursively
    // 2. It exists and have no references (blob files) -> do nothing
    // 3. It is missing -> report as missing
    // We use a maps to hold file names becuase the same file may be referenced multiple times
    // by different files (for example a blob that is used in several releases)
    // but we only want to mark the same filename as missing once
    const fileNamesWithRefs = new Set<string>();
    const fileNamesThatAreMissing = new Set<string>();
    for (const fileName of fileNames) {
      if (existingFiles.has(fileName) === true) {
        if (fileName.endsWith(".json")) {
          // 1. It exists and have references (json files)
          fileNamesWithRefs.add(fileName);
        }
        // 2. It exists and have no references (blob files) -> do nothing
      } else {
        // 3. It is missing
        fileNamesThatAreMissing.add(fileName);
      }
    }

    // Read all the files that may have references to other files
    // We can read all the files in parallel but we need to limit it becuase
    // the operating system and nodejs does not support too many open files
    const fileNamesToRead = Array.from(fileNamesWithRefs.keys());
    const fileNamesToReadChunked = chunkArrayInGroups(fileNamesToRead, readFilesInParallel);
    const allReferencedFileNames = new Set<string>();
    for (const chunk of fileNamesToReadChunked) {
      const chunkPromises = chunk.map((fileName) =>
        readFileWithRefs(path.join(filePath, fileName)).then((fileWithRefs) => {
          if (fileWithRefs === undefined) {
            // JSON could not be parsed or some other error
            fileNamesThatAreMissing.add(fileName);
            return { refs: undefined };
          } else {
            return fileWithRefs;
          }
        })
      );
      const chunkContent = await Promise.all(chunkPromises);
      stats.readFiles = stats.readFiles + chunk.length;
      for (const content of chunkContent) {
        const referencedFileNames: ReadonlyArray<string> = (content.refs && Object.values(content.refs)) || [];
        for (const referencedFileName of referencedFileNames) {
          allReferencedFileNames.add(referencedFileName);
        }
      }
    }

    // Now we have all the filenames referenced by the files we originally got as in-parameter
    // So we can recurse on them....
    // let missingChildFiles: ReadonlyArray<string> = [];
    let missingChildFiles: MissingFilesResult = { missingFiles: [], referencedFiles: [] };
    if (allReferencedFileNames.size > 0) {
      const allReferencedFileNamesArray = Array.from(allReferencedFileNames.keys());
      missingChildFiles = await getMissingFilesRecursive(
        filePath,
        existingFiles,
        allReferencedFileNamesArray,
        level + 1,
        stats,
        readFilesInParallel
      );
    }

    const missingFiles = [...missingChildFiles.missingFiles, ...Array.from(fileNamesThatAreMissing.keys())];
    const referencedFiles = [...missingChildFiles.referencedFiles, ...fileNames];
    span.setAttribute("missing file count", missingFiles.length);
    span.setAttribute("referencedFiles", referencedFiles.length);
    return {
      missingFiles: missingFiles,
      referencedFiles: referencedFiles,
    };
  });
}

async function readFileWithRefs(fileName: string): Promise<FileWithRefs | undefined> {
  return await withSpan("readFileWithRefs", async (span) => {
    span.setAttribute("filename", fileName);
    try {
      return JSON.parse(await fsp.readFile(fileName, "utf8"));
    } catch (ex) {
      return undefined;
    }
  });
}

function chunkArrayInGroups<T>(arr: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> {
  const myArray = [];
  for (let i = 0; i < arr.length; i += size) {
    myArray.push(arr.slice(i, i + size));
  }
  return myArray;
}

// function intersection<T>(setA: Set<T>, setB: Set<T>): Set<T> {
//   const _intersection = new Set();
//   for (const elem of Array.from(setB)) {
//     if (setA.has(elem)) {
//       _intersection.add(elem);
//     }
//   }
//   return _intersection;
// }

function difference<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const _difference = new Set(setA);
  for (const elem of Array.from(setB)) {
    _difference.delete(elem);
  }
  return _difference;
}
