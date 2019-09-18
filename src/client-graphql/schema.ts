import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLSchema,
  GraphQLID,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLList,
  GraphQLBoolean,
} from "graphql";
import { queryResolvers, markerResolvers } from "./resolvers";

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

const productType = new GraphQLObjectType({
  name: "Product",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    key: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    retired: { type: new GraphQLNonNull(GraphQLBoolean) },
    transactionId: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const markerType = new GraphQLObjectType({
  name: "Marker",
  fields: {
    markerName: { type: new GraphQLNonNull(GraphQLString) },
    releaseId: { type: GraphQLString },
    releaseName: { type: GraphQLString },
    transactionId: { type: GraphQLString },
    products: { type: new GraphQLNonNull(GraphQLList(productType)), resolve: markerResolvers.products },
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
      type: new GraphQLList(markerType),
      resolve: queryResolvers.markers,
    },
  },
});

export const schema = new GraphQLSchema({ query: queryType });
