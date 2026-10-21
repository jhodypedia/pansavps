import "server-only";

import { eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

export type RateResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Rate limit sederhana berbasis SQLite (aman untuk multi-proses).
 * Tahan error: bila tabel belum ada, jangan blokir aplikasi.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = new Date();
  try {
    db.delete(rateLimits).where(lt(rateLimits.expiresAt, now)).run();
    const row = db.select().from(rateLimits).where(eq(rateLimits.key, key)).get();
    if (!row) {
      db.insert(rateLimits)
        .values({
          key,
          count: 1,
          windowStart: now,
          expiresAt: new Date(now.getTime() + windowMs),
        })
        .run();
      return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
    }
    if (row.count >= limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((row.expiresAt.getTime() - now.getTime()) / 1000),
        ),
      };
    }
    db.update(rateLimits)
      .set({ count: row.count + 1 })
      .where(eq(rateLimits.key, key))
      .run();
    return { ok: true, remaining: limit - row.count - 1, retryAfterSeconds: 0 };
  } catch {
    return { ok: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

export function clearRateLimit(key: string) {
  try {
    db.delete(rateLimits).where(eq(rateLimits.key, key)).run();
  } catch {
    // abaikan
  }
}

export function clientKey(prefix: string, identifier: string) {
  return `${prefix}:${identifier.toLowerCase().slice(0, 120)}`;
}
