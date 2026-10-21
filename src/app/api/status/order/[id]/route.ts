import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs, orders, services } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = db.select().from(orders).where(eq(orders.id, id)).get();
  if (!order) return NextResponse.json({ message: "Pesanan tidak ditemukan." }, { status: 404 });
  if (user.role !== "admin" && order.userId !== user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const service = db.select().from(services).where(eq(services.orderId, order.id)).get();
  const job = db
    .select()
    .from(jobs)
    .where(and(eq(jobs.type, "provision"), eq(jobs.refId, order.id)))
    .orderBy(desc(jobs.createdAt))
    .get();

  return NextResponse.json({
    order: {
      id: order.id,
      number: order.orderNumber,
      status: order.status,
      error: order.errorMessage,
      paidAt: order.paidAt,
    },
    service: service
      ? {
          id: service.id,
          status: service.status,
          hostname: service.hostname,
          ipv4: service.ipv4,
        }
      : null,
    job: job
      ? { status: job.status, step: job.step, attempts: job.attempts, error: job.lastError }
      : null,
  });
}
