// Checks the Cloudflare Access token on API requests.
//
// Access adds a signed JWT to every request it lets through, in the
// Cf-Access-Jwt-Assertion header. The Worker verifies it on every API request,
// so a deployment that forgot to set up Access returns nothing instead of
// exposing the usage of the account.

import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from "jose";
import { isPassingStatus, retry } from "../shared/retry.ts";
import type { AccessConfig } from "./runtime-config.ts";

export type KeySetProvider = (teamDomain: string) => JWTVerifyGetKey;

export interface AccessIdentity {
  email: string | null;
}

export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessDeniedError";
  }
}

const keySets = new Map<string, JWTVerifyGetKey>();

/** Loads the signing keys of an Access team and keeps them for the life of the isolate. */
export const remoteKeySet: KeySetProvider = (teamDomain) => {
  let keySet = keySets.get(teamDomain);
  if (keySet === undefined) {
    // A load of the keys that failed in a way that may pass runs again, twice at most.
    const remote = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", teamDomain));
    keySet = (header, token) => retry(() => remote(header, token), { attempts: 3, firstDelayMs: 200, retryable: isKeyLoadFailure });
    keySets.set(teamDomain, keySet);
  }
  return keySet;
};

// The keys did not arrive: a lost connection, no answer in time, or an answer other than 200.
function isKeyLoadFailure(error: unknown): boolean {
  return error instanceof TypeError
    || error instanceof errors.JWKSTimeout
    || (error instanceof errors.JOSEError && error.message.startsWith("Expected 200 OK"));
}

export async function verifyAccessToken(
  token: string | undefined,
  access: AccessConfig,
  keySet: JWTVerifyGetKey,
): Promise<AccessIdentity> {
  if (token === undefined || token === "") {
    throw new AccessDeniedError("The request has no Cloudflare Access token.");
  }
  try {
    const { payload } = await jwtVerify(token, keySet, { issuer: access.teamDomain, audience: access.aud });
    return { email: typeof payload["email"] === "string" ? payload["email"] : null };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AccessDeniedError(`The Cloudflare Access token is not valid: ${reason}`);
  }
}

/** Thrown when Access does not tell how and when the person signed in. */
export class AccessIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessIdentityError";
  }
}

export type IdentityFetcher = (teamDomain: string, token: string) => Promise<unknown>;

/**
 * Asks Access for the identity of the session behind a token. The token holds only part
 * of the identity: the login method and the time of the sign-in are in the rest.
 */
/** Asks Access for the identity of a session, and again after a lost connection or a busy Access, twice at most. */
export const fetchAccessIdentity: IdentityFetcher = (teamDomain, token) =>
  retry(
    async () => {
      const response = await fetch(new URL("/cdn-cgi/access/get-identity", teamDomain), {
        headers: { cookie: `CF_Authorization=${token}` },
      });
      if (!response.ok) throw new IdentityAnswer(response.status);
      return (await response.json()) as unknown;
    },
    { attempts: 3, firstDelayMs: 200, retryable: (error) => error instanceof TypeError || (error instanceof IdentityAnswer && isPassingStatus(error.status)) },
  ).catch((error: unknown) => {
    if (error instanceof IdentityAnswer) throw new AccessIdentityError(`Cloudflare Access answered ${error.status} for the identity of the session.`);
    throw error;
  });

/** An answer of Access other than 200, kept with its status to tell a passing one. */
class IdentityAnswer extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Cloudflare Access answered ${status}.`);
    this.status = status;
  }
}

/**
 * Reads the login method and the time of the sign-in from an identity of Access, or
 * returns null when either is missing. Access writes the time in seconds since 1970.
 */
export function readSignIn(identity: unknown): { method: string; signedInAt: string } | null {
  if (typeof identity !== "object" || identity === null) return null;
  const { idp, iat } = identity as { idp?: unknown; iat?: unknown };
  const method = typeof idp === "object" && idp !== null ? (idp as { type?: unknown }).type : undefined;
  if (typeof method !== "string" || method === "" || typeof iat !== "number" || !Number.isFinite(iat)) return null;
  return { method, signedInAt: new Date(iat * 1000).toISOString() };
}

/** True for requests to this machine, the only place where local development mode answers. */
export function isLocalhost(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}
