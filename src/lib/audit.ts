import "server-only";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { uid } from "@/lib/format";
import type { SessionUser } from "@/lib/auth";

export type AuditInput = {
  actor?: SessionUser | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
};

export async function writeAudit(input: AuditInput): Promise<void> {
  let ip = input.ip ?? null;
  if (!ip) {
    try {
      const h = await headers();
      ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "127.0.0.1";
    } catch {
      ip = "system";
    }
  }
  try {
    db.insert(auditLogs)
      .values({
        id: uid("aud_", 16),
        actorId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? "system",
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        before: input.before ?? null,
        after: input.after ?? null,
        ip,
      })
      .run();
  } catch (error) {
    console.error("[audit] gagal menulis log", error);
  }
}
