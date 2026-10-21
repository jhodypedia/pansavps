import "server-only";

import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { uid } from "@/lib/format";
import { clientMeta } from "@/lib/auth";

/** Audit login/registrasi/logout tanpa membutuhkan sesi aktif. */
export async function auditLogin(input: {
  userId: string;
  email: string;
  action: "login" | "logout" | "register";
}): Promise<void> {
  try {
    const meta = await clientMeta();
    db.insert(auditLogs)
      .values({
        id: uid("aud_", 16),
        actorId: input.userId,
        actorEmail: input.email,
        action: input.action,
        entity: "user",
        entityId: input.userId,
        after: { action: input.action },
        ip: meta.ip,
      })
      .run();
  } catch (error) {
    console.error("[audit] gagal mencatat login", error);
  }
}
