import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLSchema,
  GraphQLID,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLList,
  GraphQLBoolean,
  GraphQLFieldConfigMap,
} from "graphql";
import { queryResolvers, markerResolvers, productResolvers, markersResolver } from "./resolvers";
import { RootFile, buildRootFileName } from "../file-types";
import { GetFilesDir } from "./context";
import Koa from "koa";
import { markerFileNameToApiMarker, readJsonFile, toSafeName } from "./read-files";

export async function createSchema(koaCtx: Koa.Context, getFilesDir: GetFilesDir): Promise<GraphQLSchema> {
  const treeRelation = new GraphQLObjectType({
    name: "TreeRelation",
    fields: {
      parentId: { type: GraphQLID },
      childId: { type: new GraphQLNonNull(GraphQLID) },
      sortNo: { type: new GraphQLNonNull(GraphQLInt) },
    },
  });

  const treeType = new GraphQLObjectType({
    name: "Tree",
    fields: {
      name: { type: new GraphQLNonNull(GraphQLString) },
      relations: {
        type: new GraphQLNonNull(GraphQLList(treeRelation)),
      },
    },
  });

  const queryType = new GraphQLObjectType({
    name: "Query",
    fields: {
      trees: {
        type: new GraphQLList(treeType),
        resolve: queryResolvers.trees,
      },
      markers: {
        type: await buildMarkersType(koaCtx, getFilesDir),
        resolve: markersResolver,
      },
    },
  });

  return new GraphQLSchema({ query: queryType });
}

// Every marker has a different schema since the products in the marker have different tables etc.
export async function buildMarkersType(koaCtx: Koa.Context, getFilesDir: GetFilesDir): Promise<GraphQLObjectType> {
  // Read all markers
  const rootFileContent = await readJsonFile<RootFile>(getFilesDir(koaCtx), buildRootFileName());
  const fields: GraphQLFieldConfigMap<unknown, unknown, unknown> = {};
  for (const m of Object.keys(rootFileContent.data.markers)) {
    const fileName = rootFileContent.refs[rootFileContent.data.markers[m]];
    const marker = await markerFileNameToApiMarker(koaCtx, getFilesDir, m, fileName);
    const safeMarkerName = toSafeName(marker.markerName);
    fields[safeMarkerName] = {
      type: new GraphQLObjectType({
        name: `Marker_${safeMarkerName}`,
        fields: {
          markerName: { type: new GraphQLNonNull(GraphQLString) },
          releaseId: { type: GraphQLString },
          releaseName: { type: GraphQLString },
          transactionId: { type: GraphQLString },
          products: {
            type: new GraphQLNonNull(GraphQLList(buildProductType(safeMarkerName))),
            resolve: markerResolvers.products,
          },
        },
      }),
    };
  }

  return new GraphQLObjectType({
    name: "Markers",
    fields,
  });
}

function buildProductType(markerName: string): GraphQLObjectType {
  const productType = new GraphQLObjectType({
    name: `Product_${markerName}`,
    fields: {
      id: { type: new GraphQLNonNull(GraphQLID) },
      key: { type: new GraphQLNonNull(GraphQLString) },
      name: { type: new GraphQLNonNull(GraphQLString) },
      retired: { type: new GraphQLNonNull(GraphQLBoolean) },
      transactionId: { type: new GraphQLNonNull(GraphQLString) },
      tables: { type: buildTablesType(markerName), resolve: productResolvers.tables },
    },
  });
  return productType;
}

function buildTablesType(markerName: string): GraphQLObjectType {
  // Get all tables that exists for this marker

  const tablesType = new GraphQLObjectType({
    name: `Tables_${markerName}`,
    fields: {
      table1: { type: new GraphQLNonNull(GraphQLID) },
      table2: { type: new GraphQLNonNull(GraphQLID) },
    },
  });
  return tablesType;
}
