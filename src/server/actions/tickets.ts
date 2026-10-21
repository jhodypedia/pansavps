"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ticketReplies, tickets, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { notifyAdmins, notifyUserEvent } from "@/lib/notifications";
import { writeAudit } from "@/lib/audit";
import { ticketNumber, uid } from "@/lib/format";
import { rateLimit } from "@/lib/rate-limit";
import { ticketReplySchema, ticketSchema } from "@/lib/validators";
import type { ActionResult } from "./types";
import { done, errorMessage, fail, fromZod } from "./utils";

export async function createTicketAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir. Silakan masuk kembali.");
  const parsed = ticketSchema.safeParse({
    subject: formData.get("subject"),
    department: formData.get("department"),
    priority: formData.get("priority"),
    message: formData.get("message"),
  });
  if (!parsed.success) return fromZod(parsed.error);

  const limit = rateLimit(`ticket:${user.id}`, 6, 60 * 60 * 1000);
  if (!limit.ok) return fail("Terlalu banyak tiket dalam satu jam. Tunggu sebentar.");

  const id = uid("tkt_", 16);
  const number = ticketNumber();
  db.transaction((tx) => {
    tx.insert(tickets)
      .values({
        id,
        ticketNumber: number,
        userId: user.id,
        subject: parsed.data.subject,
        department: parsed.data.department,
        priority: parsed.data.priority,
        status: "open",
      })
      .run();
    tx.insert(ticketReplies)
      .values({
        id: uid("trp_", 16),
        ticketId: id,
        userId: user.id,
        authorRole: "user",
        body: parsed.data.message,
      })
      .run();
  });

  await notifyAdmins({
    type: "ticket_created",
    title: "Tiket baru",
    body: `${user.name}: ${parsed.data.subject}`,
    link: `/admin/tickets/${id}`,
    waEvent: "ticket_created",
    waMessage: `Tiket baru ${number}\nDari: ${user.name}\nSubjek: ${parsed.data.subject}`,
  });
  revalidatePath("/dashboard/tiket");
  revalidatePath("/admin/tickets");
  return done("Tiket berhasil dibuat. Tim support akan membalas secepatnya.", {
    redirectTo: `/dashboard/tiket/${id}`,
  });
}

export async function replyTicketAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  const parsed = ticketReplySchema.safeParse({
    ticketId: formData.get("ticketId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return fromZod(parsed.error);

  const ticket = db.select().from(tickets).where(eq(tickets.id, parsed.data.ticketId)).get();
  if (!ticket) return fail("Tiket tidak ditemukan.");
  if (ticket.userId !== user.id && user.role !== "admin") return fail("Kamu tidak punya akses.");
  if (ticket.status === "closed" && user.role !== "admin") return fail("Tiket sudah ditutup.");

  db.transaction((tx) => {
    tx.insert(ticketReplies)
      .values({
        id: uid("trp_", 16),
        ticketId: ticket.id,
        userId: user.id,
        authorRole: user.role === "admin" ? "admin" : "user",
        body: parsed.data.body,
      })
      .run();
    tx.update(tickets)
      .set({
        status: user.role === "admin" ? "answered" : "open",
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticket.id))
      .run();
  });

  if (user.role === "admin") {
    const owner = db.select().from(users).where(eq(users.id, ticket.userId)).get();
    if (owner) {
      await notifyUserEvent({
        userId: owner.id,
        event: "ticket_replied",
        title: "Tiket dibalas",
        body: `Tiket "${ticket.subject}" sudah dibalas tim support.`,
        link: `/dashboard/tiket/${ticket.id}`,
        emailVars: {
          ticket_number: ticket.ticketNumber,
          subject: ticket.subject,
          link: `/dashboard/tiket/${ticket.id}`,
        },
        waPayload: {
          ticket_number: ticket.ticketNumber,
          subject: ticket.subject,
          link: `/dashboard/tiket/${ticket.id}`,
        },
      });
    }
  } else {
    await notifyAdmins({
      type: "ticket_replied",
      title: "Balasan user",
      body: `${user.name} membalas tiket ${ticket.ticketNumber}.`,
      link: `/admin/tickets/${ticket.id}`,
    });
  }

  revalidatePath(`/dashboard/tiket/${ticket.id}`);
  revalidatePath(`/admin/tickets/${ticket.id}`);
  revalidatePath("/dashboard/tiket");
  revalidatePath("/admin/tickets");
  return done(user.role === "admin" ? "Balasan terkirim." : "Balasan dikirim.");
}

export async function closeTicketAction(ticketId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  const ticket = db.select().from(tickets).where(eq(tickets.id, ticketId)).get();
  if (!ticket) return fail("Tiket tidak ditemukan.");
  if (ticket.userId !== user.id && user.role !== "admin") return fail("Kamu tidak punya akses.");
  db.update(tickets).set({ status: "closed", updatedAt: new Date() }).where(eq(tickets.id, ticket.id)).run();
  await writeAudit({ actor: user, action: "close_ticket", entity: "ticket", entityId: ticket.id });
  revalidatePath(`/dashboard/tiket/${ticket.id}`);
  revalidatePath(`/admin/tickets/${ticket.id}`);
  revalidatePath("/dashboard/tiket");
  revalidatePath("/admin/tickets");
  return done("Tiket ditutup.");
}

export async function reopenTicketAction(ticketId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir.");
  const ticket = db.select().from(tickets).where(eq(tickets.id, ticketId)).get();
  if (!ticket) return fail("Tiket tidak ditemukan.");
  if (ticket.userId !== user.id && user.role !== "admin") return fail("Kamu tidak punya akses.");
  db.update(tickets).set({ status: "open", updatedAt: new Date() }).where(eq(tickets.id, ticket.id)).run();
  revalidatePath(`/dashboard/tiket/${ticket.id}`);
  revalidatePath(`/admin/tickets/${ticket.id}`);
  return done("Tiket dibuka kembali.");
}

export async function updateTicketMetaAction(
  ticketId: string,
  input: { status?: "open" | "answered" | "closed"; priority?: "low" | "normal" | "high" | "urgent"; internalNote?: string },
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return fail("Hanya admin yang dapat mengubah tiket.");
  const ticket = db.select().from(tickets).where(eq(tickets.id, ticketId)).get();
  if (!ticket) return fail("Tiket tidak ditemukan.");
  try {
    db.update(tickets)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(tickets.id, ticketId))
      .run();
    await writeAudit({
      actor: user,
      action: "update_ticket",
      entity: "ticket",
      entityId: ticketId,
      after: input,
    });
    revalidatePath(`/admin/tickets/${ticketId}`);
    return done("Tiket diperbarui.");
  } catch (error) {
    return fail(errorMessage(error));
  }
}
