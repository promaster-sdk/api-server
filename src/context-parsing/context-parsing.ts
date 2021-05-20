import * as Uuid from "uuid";
import Koa from "koa";
import { getHeaderIgnoreCase } from "./headers";

export function getDatabaseId(ctx: Koa.Context, fallbackTenantId: boolean): string {
  const tenantId = getHeaderIgnoreCase(ctx.headers, "X-Promaster-SelectedTenantId");

  // First check if database_id is specified in koa name parameters.
  // Second check if regex is used with koa router. If so it should be the first capture group
  // If fallbackTenantId is true check the header for tenant_id and use it as database_id for backwards compability
  let databaseId = (ctx.params.database_id || ctx.params[0] || ("" as string)).replace(/\//g, "");
  if (!databaseId && fallbackTenantId && tenantId) {
    databaseId = tenantId;
  }

  if (!databaseId) {
    throw new Error(`Missing database id in url`);
  }

  if (!Uuid.validate(databaseId)) {
    throw new Error(`Invalid database id: ${databaseId}`);
  }
  return databaseId;
}
