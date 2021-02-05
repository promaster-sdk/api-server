import * as Koa from "koa";
import * as uuid from "uuid";
import { validateToken, DecodedToken } from "./token-validation";
import { getHeaderIgnoreCase } from "../context-parsing";

export const createVerifyPublishApiMiddleware = (jwksUri: string, validClients: ReadonlyArray<string>) => async (
  ctx: Koa.Context,
  next: () => Promise<void>
): Promise<void> => {
  // Get the Authorization header
  const authorization =
    getKeyValueIgnoreCase(ctx.headers, "Authorization") || getKeyValueIgnoreCase(ctx.query, "access_token");
  if (!authorization) {
    ctx.status = 403;
    console.warn("Unauthorized request");
    return;
  }
  const token = authorization.replace("Bearer ", "");
  let decoded: DecodedToken;
  try {
    decoded = await validateToken(jwksUri, token);
  } catch (err) {
    console.warn("Exception while validating token, the error was: ", err);
    ctx.status = 403;
    return;
  }

  // Fallback. If no database id is in url fallback to validate tenant
  const maybeDatabaseId = ctx.request.path.match(
    /^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12})/
  );
  if (!uuid.validate(maybeDatabaseId?.[1] || "")) {
    const selectedTenant = getHeaderIgnoreCase(ctx.headers, "X-Promaster-SelectedTenantId");
    console.warn("Old auth request, Veryfing tenant_id: ", selectedTenant);
    const additionalTenants = getAdditionalTenants(decoded);

    const mainTenant = decoded["promaster/claims/tenant_id"];
    const allTenants = [mainTenant, ...additionalTenants];
    if (!selectedTenant || !allTenants.some((at) => at.includes(selectedTenant))) {
      console.warn(`SelectedTenant: ${selectedTenant} is not in allowed tenants: ${allTenants.join(", ")}`);
      ctx.status = 403;
      return;
    }
    await next();
    return;
  }

  const clientId = (decoded["clientId"] || "").toUpperCase();
  if (!validClients.map((c) => c.toUpperCase()).includes(clientId)) {
    console.warn(`Client id=${clientId} is not allowed access`);
    ctx.status = 403;
    return;
  }

  await next();
};

function getKeyValueIgnoreCase(keyValues: { readonly [key: string]: string }, key: string): string | undefined {
  const keyLower = key.toLowerCase();
  const found = Object.keys(keyValues).find((header) => header.toLowerCase() === keyLower);
  if (found !== undefined) {
    return keyValues[found];
  }
  return undefined;
}

function getAdditionalTenants(decodedToken: DecodedToken): ReadonlyArray<string> {
  const claim = decodedToken["promaster/claims/additional_tenant"];
  if (!claim) {
    return [];
  }

  if (typeof claim === "string") {
    return [claim];
  }

  return claim;
}
