import * as Uuid from "uuid";
import Koa from "koa";
import { getHeaderIgnoreCase } from "./headers";

export function getDatabaseId(ctx: Koa.Context, fallbackTenantId: boolean): string {
  const tenantId = getHeaderIgnoreCase(ctx.headers, "X-Promaster-SelectedTenantId");
  let databaseId = ctx.params.database_id;
  if (!databaseId && fallbackTenantId) {
    databaseId = tenantId;
  }

  if (!databaseId) {
    throw new Error(`Missing database id in url`);
  }

  if (!Uuid.validate(databaseId)) {
    throw new Error(`Invalid database id: ${ctx.param.databaseId}`);
  }
  return databaseId;
}
