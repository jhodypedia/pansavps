import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listTripayChannels } from "@/lib/payments/tripay";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireUser();
  const force = new URL(request.url).searchParams.get("force") === "1";
  const channels = await listTripayChannels({ force });
  return NextResponse.json(
    { channels },
    { headers: { "Cache-Control": "no-store" } },
  );
}
