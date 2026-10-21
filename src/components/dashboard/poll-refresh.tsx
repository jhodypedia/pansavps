"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PollRefresh({
  enabled = true,
  intervalMs = 8000,
}: {
  enabled?: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, router]);
  return null;
}
