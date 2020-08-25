import * as Koa from "koa";
import { validateToken } from "./token-validation";

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
  // if (parts.length !== 2 || parts[0] !== "Bearer") {
  //   ctx.status = 403;
  //   return;
  // }
  // const token = parts[1];
  try {
    const decoded = await validateToken(jwksUri, token);
    console.log("decoded: ", decoded);
    const clientId = (decoded["clientId"] || "").toUpperCase();
    if (!validClients.map((c) => c.toUpperCase()).includes(clientId)) {
      throw new Error(`Client id is not allowed access ${clientId}`);
    }
  } catch (err) {
    console.warn("Exception while validating token, the error was: ", err);
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
