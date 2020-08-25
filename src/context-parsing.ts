import * as Uuid from "uuid";
import Koa from "koa";

export function getDatabaseId(ctx: Koa.Context): string {
  const databaseId = ctx.params.database_id;

  if (!databaseId) {
    throw new Error(`Missing database id in url`);
  }

  if (!Uuid.validate(databaseId)) {
    throw new Error(`Invalid database id: ${ctx.param.databaseId}`);
  }
  return databaseId;
}
