"use client";

import { Send } from "lucide-react";
import {
  closeTicketAction,
  createTicketAction,
  replyTicketAction,
  reopenTicketAction,
} from "@/server/actions/tickets";
import { ActionForm } from "@/components/dashboard/action-form";
import { ActionButton } from "@/components/dashboard/action-button";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewTicketForm({
  defaultSubject = "",
  defaultDepartment = "teknis",
}: {
  defaultSubject?: string;
  defaultDepartment?: string;
}) {
  return (
    <ActionForm action={createTicketAction}>
      <div className="space-y-2">
        <Label htmlFor="subject">Subjek</Label>
        <Input
          id="subject"
          name="subject"
          defaultValue={defaultSubject}
          placeholder="Ringkasan singkat masalah"
          minLength={5}
          maxLength={120}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="department">Departemen</Label>
          <select
            id="department"
            name="department"
            defaultValue={defaultDepartment}
            className="h-9 w-full rounded-md border border-[#D8E2DB] bg-white px-3 text-sm"
          >
            <option value="teknis">Teknis</option>
            <option value="billing">Billing</option>
            <option value="umum">Umum</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Prioritas</Label>
          <select
            id="priority"
            name="priority"
            defaultValue="normal"
            className="h-9 w-full rounded-md border border-[#D8E2DB] bg-white px-3 text-sm"
          >
            <option value="low">Rendah</option>
            <option value="normal">Normal</option>
            <option value="high">Tinggi</option>
            <option value="urgent">Mendesak</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Pesan</Label>
        <Textarea
          id="message"
          name="message"
          rows={8}
          minLength={10}
          maxLength={5000}
          required
          placeholder="Jelaskan kendala, langkah yang sudah dicoba, dan informasi layanan terkait."
        />
      </div>
      <SubmitButton pendingText="Mengirim tiket…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
        <Send className="size-4" /> Kirim tiket
      </SubmitButton>
    </ActionForm>
  );
}

export function TicketReplyForm({ ticketId, closed }: { ticketId: string; closed: boolean }) {
  if (closed) {
    return (
      <div className="rounded-xl border border-[#E3E8E4] bg-[#F7F8F7] p-4">
        <p className="text-sm text-[#5B6B60]">Tiket ini sudah ditutup.</p>
        <div className="mt-3">
          <ActionButton action={() => reopenTicketAction(ticketId)} variant="outline" className="border-[#D8E2DB] bg-white">
            Buka kembali tiket
          </ActionButton>
        </div>
      </div>
    );
  }
  return (
    <ActionForm action={replyTicketAction} resetOnSuccess>
      <input type="hidden" name="ticketId" value={ticketId} />
      <div className="space-y-2">
        <Label htmlFor="reply-body">Balasan</Label>
        <Textarea id="reply-body" name="body" rows={4} maxLength={5000} required placeholder="Tulis balasan…" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ActionButton
          action={() => closeTicketAction(ticketId)}
          variant="outline"
          className="border-[#FECACA] text-[#B91C1C] hover:bg-[#FEE2E2]"
          confirm="Tutup tiket ini? Kamu masih bisa membukanya kembali nanti."
        >
          Tutup tiket
        </ActionButton>
        <SubmitButton pendingText="Mengirim…" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
          <Send className="size-4" /> Kirim balasan
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
