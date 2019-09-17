import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLSchema,
  GraphQLID,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLList,
} from "graphql";
import { queryResolvers } from "./resolvers";

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
      resolve: (parent) => {
        return parent.relations;
      },
    },
  },
});

// Define the Query type
const queryType = new GraphQLObjectType({
  name: "Query",
  fields: {
    trees: {
      type: new GraphQLList(treeType),
      resolve: queryResolvers.trees,
    },
  },
});

export const schema = new GraphQLSchema({ query: queryType });
