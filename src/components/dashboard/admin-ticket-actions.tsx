"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { updateTicketMetaAction } from "@/server/actions/tickets";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toastError, toastSuccess } from "@/lib/toast";

type Status = "open" | "answered" | "closed";
type Priority = "low" | "normal" | "high" | "urgent";

export function AdminTicketMetaForm({
  ticketId,
  status,
  priority,
  internalNote,
}: {
  ticketId: string;
  status: Status;
  priority: Priority;
  internalNote: string | null;
}) {
  const [nextStatus, setNextStatus] = useState<Status>(status);
  const [nextPriority, setNextPriority] = useState<Priority>(priority);
  const [note, setNote] = useState(internalNote ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      const result = await updateTicketMetaAction(ticketId, {
        status: nextStatus,
        priority: nextPriority,
        internalNote: note.trim() || undefined,
      });
      if (result.ok) {
        toastSuccess(result.message);
        router.refresh();
      } else {
        toastError(result.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={nextStatus} onValueChange={(value) => setNextStatus(value as Status)}>
            <SelectTrigger className="border-[#D8E2DB] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Terbuka</SelectItem>
              <SelectItem value="answered">Dibalas</SelectItem>
              <SelectItem value="closed">Ditutup</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Prioritas</Label>
          <Select value={nextPriority} onValueChange={(value) => setNextPriority(value as Priority)}>
            <SelectTrigger className="border-[#D8E2DB] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Rendah</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">Tinggi</SelectItem>
              <SelectItem value="urgent">Mendesak</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`internal-${ticketId}`}>Catatan internal</Label>
        <Textarea
          id={`internal-${ticketId}`}
          rows={3}
          maxLength={2000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Hanya terlihat oleh admin."
        />
      </div>
      <Button
        type="button"
        onClick={save}
        disabled={pending}
        className="w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {pending ? "Menyimpan…" : "Simpan perubahan"}
      </Button>
    </div>
  );
}
