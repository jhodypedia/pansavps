import { NextResponse } from "next/server";
import { runCron } from "@/server/services/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const header = request.headers.get("x-cron-secret");
  return bearer === secret || header === secret;
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runCron();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("[cron] gagal", error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Cron gagal." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
