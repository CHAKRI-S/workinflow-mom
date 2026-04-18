/**
 * Super Admin Authentication
 *
 * Separate auth system from tenant NextAuth:
 * - Own cookie: `sa_token`
 * - Own JWT secret: SA_JWT_SECRET env var (falls back to AUTH_SECRET in dev)
 * - Own token payload (SuperAdmin model, not User)
 * - Edge-compatible (uses `jose`, not `jsonwebtoken`)
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const SA_COOKIE_NAME = "sa_token";
const SA_JWT_ISSUER = "workinflow-sa";
const SA_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

export interface SaTokenPayload {
  sub: string; // SuperAdmin.id
  username: string;
  email: string;
  name: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.SA_JWT_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("SA_JWT_SECRET (or AUTH_SECRET) env var not set");
  }
  return new TextEncoder().encode(secret);
}

/** Sign a new SA JWT */
export async function signSaToken(payload: SaTokenPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(SA_JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SA_TOKEN_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

/** Verify an SA JWT and return payload, or null if invalid */
export async function verifySaToken(token: string): Promise<SaTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: SA_JWT_ISSUER,
    });
    if (!payload.sub) return null;
    return {
      sub: payload.sub as string,
      username: payload.username as string,
      email: payload.email as string,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}

/** Read the current SA session from cookies (server components / API routes) */
export async function getSaSession(): Promise<SaTokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SA_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySaToken(token);
}

/** Require SA session — throws if not authenticated (for API routes) */
export async function requireSaSession(): Promise<SaTokenPayload> {
  const session = await getSaSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

/** Load the full SuperAdmin record from DB (use sparingly — prefer getSaSession) */
export async function getSaUser(sub: string) {
  return prisma.superAdmin.findUnique({
    where: { id: sub, isActive: true },
  });
}

/** Cookie options for SA auth cookie */
export const SA_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SA_TOKEN_MAX_AGE_SECONDS,
};
