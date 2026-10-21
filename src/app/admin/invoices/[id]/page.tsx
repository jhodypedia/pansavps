import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, orders, payments, services, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { markInvoicePaidAction } from "@/server/actions/admin";
import {
  formatDateTime,
  formatIDR,
  invoiceStatusLabel,
  invoiceTypeLabel,
} from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { InfoRow, SectionCard } from "@/components/dashboard/section-card";
import { ActionButton } from "@/components/dashboard/action-button";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Detail Invoice Admin" };

export default async function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const invoice = db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!invoice) notFound();

  const owner = db.select().from(users).where(eq(users.id, invoice.userId)).get();
  const order = invoice.orderId ? db.select().from(orders).where(eq(orders.id, invoice.orderId)).get() : null;
  const service = invoice.serviceId ? db.select().from(services).where(eq(services.id, invoice.serviceId)).get() : null;
  const paymentRows = db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoice.id))
    .orderBy(desc(payments.createdAt))
    .all();
  const meta = invoice.metadata ?? {};
  const planName =
    (typeof meta.planName === "string" && meta.planName) ||
    order?.priceSnapshot.planName ||
    (invoice.type === "topup" ? "Top up saldo" : "Layanan VPS");

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Invoice", href: "/admin/invoices" },
          { label: invoice.invoiceNumber },
        ]}
        title={invoice.invoiceNumber}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={invoice.status} label={invoiceStatusLabel[invoice.status]} />
            <span>{invoiceTypeLabel[invoice.type]} · {planName}</span>
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
              <Link href="/admin/invoices">
                <ArrowLeft className="size-4" /> Kembali
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
              <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
                <Download className="size-4" /> PDF
              </a>
            </Button>
            {invoice.status === "unpaid" ? (
              <ActionButton
                action={markInvoicePaidAction.bind(null, invoice.id)}
                variant="default"
                className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
                confirm={`Tandai ${invoice.invoiceNumber} lunas tanpa verifikasi bukti?`}
              >
                <CheckCircle2 className="size-3.5" /> Tandai lunas
              </ActionButton>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <SectionCard title="Rincian invoice">
            <div className="rounded-xl border border-[#EDF1EE] bg-[#FBFCFB] p-4">
              <p className="text-sm font-bold text-[#101613]">{planName}</p>
              <p className="mt-0.5 text-xs text-[#5B6B60]">{invoiceTypeLabel[invoice.type]}</p>
              <p className="mt-3 font-display text-2xl font-bold text-[#0B3D2E]">{formatIDR(invoice.amount)}</p>
            </div>
            <dl className="mt-4 divide-y divide-[#EDF1EE]">
              <InfoRow label="Status" value={<StatusBadge status={invoice.status} label={invoiceStatusLabel[invoice.status]} />} />
              <InfoRow label="Dibuat" value={formatDateTime(invoice.createdAt)} />
              <InfoRow label="Jatuh tempo" value={formatDateTime(invoice.dueDate)} />
              <InfoRow label="Dibayar" value={formatDateTime(invoice.paidAt)} />
              <InfoRow label="Provider" value={invoice.paymentProvider ?? "—"} />
              <InfoRow label="Referensi" value={<span className="font-mono text-xs">{invoice.paymentRef ?? "—"}</span>} />
              {order ? (
                <InfoRow
                  label="Pesanan"
                  value={<Link href={`/admin/orders/${order.id}`} className="text-[#0B3D2E] hover:underline">{order.orderNumber}</Link>}
                />
              ) : null}
              {service ? (
                <InfoRow
                  label="Layanan"
                  value={<Link href={`/admin/services/${service.id}`} className="text-[#0B3D2E] hover:underline">{service.hostname}</Link>}
                />
              ) : null}
            </dl>
          </SectionCard>

          <SectionCard title="Pembayaran" bodyClassName="p-0">
            {paymentRows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#5B6B60]">Belum ada pembayaran.</p>
            ) : (
              <ul className="divide-y divide-[#EDF1EE]">
                {paymentRows.map((payment) => (
                  <li key={payment.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-[#F3F9F5] text-[#0B3D2E]">
                        <Receipt className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[#101613]">
                          {formatIDR(payment.amount)} · {payment.method ?? payment.provider}
                        </p>
                        <p className="text-xs text-[#8A9A90]">
                          {formatDateTime(payment.createdAt)}
                          {payment.verifiedBy ? " · terverifikasi" : ""}
                        </p>
                        {payment.rejectionReason ? (
                          <p className="mt-1 text-xs text-[#B91C1C]">Ditolak: {payment.rejectionReason}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {payment.proofUrl ? (
                        <Button asChild variant="ghost" size="xs" className="text-[#0B3D2E]">
                          <a href={`/api/payments/${payment.id}/proof`} target="_blank" rel="noreferrer">
                            <FileText className="size-3.5" /> Bukti
                          </a>
                        </Button>
                      ) : null}
                      <StatusBadge status={payment.status} label={payment.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {invoice.status === "unpaid" ? (
              <div className="border-t border-[#E3E8E4] p-5">
                <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
                  <Link href="/admin/payments">
                    <ShieldCheck className="size-4" /> Buka verifikasi pembayaran
                  </Link>
                </Button>
              </div>
            ) : null}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Pengguna">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-[#0B3D2E] text-sm font-bold text-white">
                {owner?.name?.[0] ?? "?"}
              </span>
              <div className="min-w-0">
                <Link href={`/admin/users/${owner?.id ?? ""}`} className="text-sm font-bold text-[#0B3D2E] hover:underline">
                  {owner?.name ?? "—"}
                </Link>
                <p className="truncate text-xs text-[#8A9A90]">{owner?.email}</p>
              </div>
            </div>
            <dl className="mt-3 divide-y divide-[#EDF1EE]">
              <InfoRow label="Telepon" value={owner?.phone ?? "—"} />
              <InfoRow label="Saldo" value={formatIDR(owner?.balance ?? 0)} />
            </dl>
            <Button asChild variant="outline" className="mt-3 w-full border-[#D8E2DB] bg-white">
              <Link href={`/admin/users/${owner?.id ?? ""}`}>
                Buka profil <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          </SectionCard>

          {order ? (
            <SectionCard title="Ringkasan pesanan">
              <dl className="divide-y divide-[#EDF1EE]">
                <InfoRow label="Paket" value={order.priceSnapshot.planName} />
                <InfoRow label="Total" value={formatIDR(order.priceSnapshot.total)} />
                <InfoRow label="Promo" value={order.priceSnapshot.promoCode ?? "—"} />
                <InfoRow label="Hostname" value={<span className="font-mono">{order.hostname}</span>} />
              </dl>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
