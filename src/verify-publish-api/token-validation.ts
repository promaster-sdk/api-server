import jwt from "jsonwebtoken";
import JwksRsa from "jwks-rsa";
// import log from "loglevel";

export interface DecodedToken {
  readonly [key: string]: string;
}

const validateTokenWithCallback = (jwksUri: string, jwksKid: string) => (
  encodedToken: string,
  cb: (err: jwt.VerifyErrors | Error | undefined, decodedToken: DecodedToken | undefined) => void
): void => {

  const jwksClient = JwksRsa({ jwksUri: jwksUri, cache: true });
  jwksClient.getSigningKey(jwksKid, (getKeyErr, key) => {
    if (getKeyErr) {
      console.warn(`Could not get signing key '${jwksKid}' from '${jwksUri}'. The error was: ${getKeyErr}.`);
      cb(getKeyErr, undefined);
    } else {
      jwt.verify(
        encodedToken,
        key.getPublicKey(),
        { clockTolerance: 900 },
        (verifyErr, decoded) => {
          cb(verifyErr || undefined, decoded as DecodedToken);
        }
      );
    }
  });
};

export async function validateToken(jwksUri: string, encodedToken: string): Promise<DecodedToken> {
  return new Promise<DecodedToken>((resolve, reject) => {
    const kid = getKidFromEncodedToken(encodedToken);
    if (!kid) {
      reject(new Error("The token does not have a kid field in its header."));
      return;
    }
    validateTokenWithCallback(jwksUri, kid)(encodedToken, (err, decoded) => {
      if (err || decoded === undefined) {
        reject(err);
        return;
      }
      resolve(decoded);
    });
  });
}

function getKidFromEncodedToken(encodedToken: string): string | undefined {
  // Get the jwksKid from the token header kid field
  const decoded = jwt.decode(encodedToken, { complete: true });
  if (typeof decoded !== "string") {
    return decoded && decoded.header && decoded.header.kid;
  }
  return undefined;
}
