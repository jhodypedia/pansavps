import Link from "next/link";
import { CheckCircle2, Clock, CreditCard, Receipt, XCircle } from "lucide-react";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, payments, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatIDR } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  ApprovePaymentButton,
  RejectPaymentDialog,
  ViewProofButton,
} from "@/components/dashboard/payment-verification";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Verifikasi Pembayaran" };

export default async function AdminPaymentsPage() {
  await requireAdmin();
  const all = db.select().from(payments).orderBy(desc(payments.createdAt)).all();
  const invoiceRows = db.select().from(invoices).all();
  const invoiceMap = new Map(invoiceRows.map((invoice) => [invoice.id, invoice]));
  const userRows = db.select().from(users).all();
  const userMap = new Map(userRows.map((user) => [user.id, user]));
  const pending = all.filter((payment) => payment.status === "pending");
  const history = all.filter((payment) => payment.status !== "pending");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verifikasi pembayaran"
        description="Tinjau bukti transfer bank dan riwayat transaksi online."
        actions={
          <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
            <Link href="/admin/invoices?status=unpaid">
              <Receipt className="size-4" /> Invoice belum dibayar
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-[#92400E]">
            <Clock className="size-4" /> Menunggu verifikasi
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-[#101613]">{pending.length}</p>
        </div>
        <div className="rounded-2xl border border-[#BFE3CC] bg-[#F3F9F5] p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-[#0B3D2E]">
            <CheckCircle2 className="size-4" /> Disetujui
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-[#101613]">
            {history.filter((payment) => payment.status === "paid").length}
          </p>
        </div>
        <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-[#991B1B]">
            <XCircle className="size-4" /> Ditolak / gagal
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-[#101613]">
            {history.filter((payment) => ["rejected", "failed"].includes(payment.status)).length}
          </p>
        </div>
      </div>

      <SectionCard title="Menunggu verifikasi" description="Pembayaran manual dengan bukti transfer." bodyClassName="p-0">
        {pending.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={CreditCard} title="Tidak ada pembayaran pending" description="Semua bukti transfer sudah ditinjau." />
          </div>
        ) : (
          <ul className="divide-y divide-[#EDF1EE]">
            {pending.map((payment) => {
              const invoice = invoiceMap.get(payment.invoiceId);
              const owner = invoice ? userMap.get(invoice.userId) : null;
              const meta = (payment.rawWebhook ?? {}) as { senderName?: string; note?: string };
              return (
                <li key={payment.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#92400E]">
                      <CreditCard className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#101613]">
                        {formatIDR(payment.amount)}
                        <span className="ml-2 text-xs font-normal text-[#8A9A90]">{payment.provider}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-[#5B6B60]">
                        {owner?.name ?? "—"} · {invoice?.invoiceNumber ?? "—"} · {formatDateTime(payment.createdAt)}
                      </p>
                      {meta.senderName ? (
                        <p className="mt-1 text-xs text-[#8A9A90]">
                          Pengirim: {meta.senderName}
                          {meta.note ? ` · ${meta.note}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {payment.proofUrl ? <ViewProofButton paymentId={payment.id} /> : null}
                    <RejectPaymentDialog paymentId={payment.id} />
                    <ApprovePaymentButton paymentId={payment.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Riwayat pembayaran" description="Transaksi terbaru." bodyClassName="p-0">
        {history.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#5B6B60]">Belum ada riwayat.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-[#E3E8E4] bg-[#F7F8F7] text-left text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">
                  <th className="px-4 py-2.5">Pembayaran</th>
                  <th className="px-4 py-2.5">Invoice</th>
                  <th className="px-4 py-2.5">Pengguna</th>
                  <th className="px-4 py-2.5">Nominal</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Waktu</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 100).map((payment) => {
                  const invoice = invoiceMap.get(payment.invoiceId);
                  const owner = invoice ? userMap.get(invoice.userId) : null;
                  return (
                    <tr key={payment.id} className="border-b border-[#EDF1EE] last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-[#101613]">{payment.providerRef ?? payment.id}</td>
                      <td className="px-4 py-3">
                        {invoice ? (
                          <Link href={`/admin/invoices/${invoice.id}`} className="font-mono text-xs text-[#0B3D2E] hover:underline">
                            {invoice.invoiceNumber}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-[#5B6B60]">{owner?.name ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold text-[#101613]">{formatIDR(payment.amount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={payment.status} label={payment.status} /></td>
                      <td className="px-4 py-3 text-xs text-[#8A9A90]">{formatDateTime(payment.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        {payment.proofUrl ? <ViewProofButton paymentId={payment.id} /> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
