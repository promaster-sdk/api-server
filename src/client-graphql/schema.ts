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

const treeType = new GraphQLObjectType({
  name: "Tree",
  fields: {
    name: { type: new GraphQLNonNull(GraphQLString) },
    parent: { type: new GraphQLNonNull(GraphQLID) },
    child: { type: new GraphQLNonNull(GraphQLID) },
    sort_no: { type: new GraphQLNonNull(GraphQLInt) },
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
