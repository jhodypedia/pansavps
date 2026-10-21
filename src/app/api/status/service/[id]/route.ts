import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { services } from "@/lib/db/schema";
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
  const service = db.select().from(services).where(eq(services.id, id)).get();
  if (!service) return NextResponse.json({ message: "Layanan tidak ditemukan." }, { status: 404 });
  if (user.role !== "admin" && service.userId !== user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: service.id,
    status: service.status,
    hostname: service.hostname,
    ipv4: service.ipv4,
    periodEnd: service.periodEnd,
    autoRenew: service.autoRenew,
  });
}
