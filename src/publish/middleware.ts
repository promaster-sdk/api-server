import Koa from "koa";
import compose from "koa-compose";
import send from "koa-send";
import Router from "@koa/router";
import multer from "koa-multer";
import path from "path";
import fs from "fs";
import mkdirp from "mkdirp";
import { promisify } from "util";
import * as Uuid from "uuid";
import { getMissingFilesForRootFiles } from "./get-missing-files";
import { getDatabaseId } from "../context-parsing";

const existsAsync = promisify(fs.exists);
const mkdirpAsync = promisify(mkdirp);

export interface GetFilesDir {
  (databaseId: string): string;
}

// This is a workaround becuase the destination function in koa-multer only get ctx.req, not full ctx.
const putCtxOnReqMiddleware = async (ctx: Koa.Context, next: () => Promise<void>) => {
  // tslint:disable-next-line:no-any
  (ctx.req as any).ctx = ctx;
  await next();
};

// Middleware to add an ID that can be used as temp-file suffix when the saveIfComplete querystring flag is used
const tempFileSuffixMiddleware = async (ctx: Koa.Context, next: () => Promise<void>) => {
  // The file has to end in ".json"
  // tslint:disable-next-line:no-any
  (ctx as any).tempFileSuffix = "_" + Uuid.v4() + ".json";
  await next();
};

export function createPublishApiMiddleware(
  getFilesDir: GetFilesDir,
  prefix?: string,
  readFilesInParallel: number = 50,
  pruneFiles = true,
  onPublishComplete: (databaseId: string) => Promise<void> = (databaseId) => {
    console.log(`Publish for database ${databaseId} complete.`);
    return Promise.resolve();
  }
): Koa.Middleware {
  // Configure multer to handle multi-part POST
  const storage = multer.diskStorage({
    destination: async (req, _file, cb) => {
      // HACK, we have added ctx to req in order to be compatible with multer's express middleware
      // tslint:disable-next-line:no-any
      const ctx: Koa.Context = (req as any).ctx;
      const dir = getFilesDir(getDatabaseId(ctx, true));
      await mkdirpAsync(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      // HACK, we have added ctx to req in order to be compatible with multer's express middleware
      // tslint:disable-next-line:no-any
      const ctx: Koa.Context = (req as any).ctx;
      // If the save=ifcomplete query string flag is set, we should only save the file
      // to the real name when we know there are recursively 0 missing files.
      // So in that case we use a temp filename
      if (ctx.query.save === "ifcomplete" || ctx.query.save === "no") {
        // tslint:disable-next-line:no-any
        const tempFileSuffix = (ctx as any).tempFileSuffix;
        cb(null, file.originalname + tempFileSuffix);
        return;
      }
      cb(null, file.originalname);
    },
  });
  const upload = multer({ storage });

  // Router that handles downloads and uploads
  const router = new Router({ prefix });

  // Download
  // router.get("/(:database_id/)?:filename", async (ctx: Router.IRouterContext) => {
  router.get(
    /^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}\/)?(.+)/,
    async (ctx: Router.RouterContext) => {
      const fileName = ctx.params[1];
      const dest = getFilesDir(getDatabaseId(ctx, true));
      const fullPath = path.join(dest, fileName);
      if (existsAsync(fullPath)) {
        await send(ctx, fileName, { root: dest });
      } else {
        ctx.status = 404;
        ctx.body = "Not found";
      }
    }
  );

  // Upload
  // router.post("/(:database_id)?", upload.array("file"), async (ctx) => {
  router.post(
    /^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12})?/,
    upload.array("file"),
    async (ctx) => {
      // tslint:disable-next-line:no-any
      const files = (ctx.req as any).files as Array<Express.Multer.File>;
      const databaseId = getDatabaseId(ctx, true);
      const filesPaths = getFilesDir(databaseId);
      // tslint:disable-next-line:no-any
      const tempFileSuffix = (ctx as any).tempFileSuffix;
      const fileNames = files.map((f) => f.filename);
      const allMissingFiles = await getMissingFilesForRootFiles(
        filesPaths,
        fileNames,
        ctx.query.save,
        tempFileSuffix,
        readFilesInParallel,
        pruneFiles,
        () => onPublishComplete(databaseId)
      );

      ctx.body = { missingFiles: allMissingFiles };
    }
  );

  // Compose full middleware
  const all = compose([tempFileSuffixMiddleware, putCtxOnReqMiddleware, router.routes(), router.allowedMethods()]);
  return all;
}
