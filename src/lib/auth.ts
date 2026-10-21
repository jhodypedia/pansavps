import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";
import { randomToken, sha256 } from "@/lib/crypto";
import { hashPassword, verifyPassword } from "@/lib/password";

export { hashPassword, verifyPassword };

export const SESSION_COOKIE = "pansa_session";
const SESSION_DAYS = 30;

export type SessionUser = Pick<
  User,
  | "id"
  | "name"
  | "email"
  | "phone"
  | "role"
  | "status"
  | "balance"
  | "emailVerifiedAt"
  | "phoneVerifiedAt"
  | "createdAt"
>;

export async function clientMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "127.0.0.1";
  return { ip, userAgent: h.get("user-agent") ?? "unknown" };
}

export async function createSession(userId: string): Promise<string> {
  const token = randomToken(32);
  const { ip, userAgent } = await clientMeta();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  db.delete(sessions).where(eq(sessions.userId, userId));
  db.insert(sessions)
    .values({
      id: randomToken(12),
      userId,
      tokenHash: sha256(token),
      userAgent,
      ip,
      expiresAt,
    })
    .run();

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) db.delete(sessions).where(eq(sessions.tokenHash, sha256(token))).run();
  jar.delete(SESSION_COOKIE);
}

export async function destroyOtherSessions(userId: string, keepToken?: string) {
  if (keepToken) {
    db.delete(sessions)
      .where(and(eq(sessions.userId, userId), ne(sessions.tokenHash, sha256(keepToken))))
      .run();
    return;
  }
  db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

export async function currentSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = await currentSessionToken();
  if (!token) return null;
  const row = db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
    .get();
  if (!row) return null;
  if (row.user.status !== "active") return null;
  const safe: SessionUser = { ...row.user };
  delete (safe as Partial<User>).passwordHash;
  return safe;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

export function isUserVerified(
  user: Pick<SessionUser, "emailVerifiedAt" | "phoneVerifiedAt">,
): boolean {
  return Boolean(user.emailVerifiedAt || user.phoneVerifiedAt);
}

export async function requireVerifiedUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isUserVerified(user)) redirect("/verifikasi-akun");
  return user;
}

export function assertOwner(resourceUserId: string, user: SessionUser) {
  if (resourceUserId !== user.id && user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
}

export async function listActiveSessions(userId: string) {
  return db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ip: sessions.ip,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      tokenHash: sessions.tokenHash,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .all();
}
