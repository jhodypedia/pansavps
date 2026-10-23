import "server-only";

import { eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

export type RateResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

let cleanupCounter = 0;

/**
 * Hapus baris kedaluwarsa secara berkala, bukan di setiap request.
 * Ini mengurangi write-lock SQLite saat traffic sedang tinggi.
 */
function cleanupExpired(now: Date) {
  cleanupCounter += 1;
  if (cleanupCounter % 200 !== 0) return;
  db.delete(rateLimits).where(lt(rateLimits.expiresAt, now)).run();
}

/**
 * Rate limit sederhana berbasis SQLite (aman untuk multi-proses).
 * Tahan error: bila tabel belum ada, jangan blokir aplikasi.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = new Date();
  try {
    cleanupExpired(now);
    const row = db.select().from(rateLimits).where(eq(rateLimits.key, key)).get();
    const active = row && row.expiresAt.getTime() > now.getTime() ? row : null;
    if (row && !active) {
      db.delete(rateLimits).where(eq(rateLimits.key, key)).run();
    }
    if (!active) {
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
    if (active.count >= limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((active.expiresAt.getTime() - now.getTime()) / 1000),
        ),
      };
    }
    db.update(rateLimits)
      .set({ count: active.count + 1 })
      .where(eq(rateLimits.key, key))
      .run();
    return { ok: true, remaining: limit - active.count - 1, retryAfterSeconds: 0 };
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
