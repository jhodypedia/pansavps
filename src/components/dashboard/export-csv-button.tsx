"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { exportCsvAction } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { toastError, toastSuccess } from "@/lib/toast";

export function ExportCsvButton({
  type,
  label = "Ekspor CSV",
}: {
  type: "orders" | "invoices" | "users";
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  async function download() {
    setPending(true);
    try {
      const result = await exportCsvAction(type);
      if (!result.ok || !result.data) {
        toastError(result.message);
        return;
      }
      const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.data.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toastSuccess(result.message);
    } catch {
      toastError("Gagal membuat CSV.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Button
      type="button"
      onClick={download}
      disabled={pending}
      variant="outline"
      className="border-[#D8E2DB] bg-white"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {pending ? "Menyiapkan…" : label}
    </Button>
  );
}
