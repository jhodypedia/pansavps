import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  CircleAlert,
  Clock3,
  CreditCard,
  Download,
  FileText,
  Info,
  Receipt,
  RotateCcw,
  Server,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, orders, payments, services } from "@/lib/db/schema";
import { isUserVerified, requireUser } from "@/lib/auth";
import { availableProviders } from "@/lib/payments";
import { listTripayChannels } from "@/lib/payments/tripay";
import { manualBankDetails } from "@/server/services/billing";
import { isServiceVisible } from "@/server/services/services";
import {
  cycleLabel,
  formatDateTime,
  formatIDR,
  invoiceStatusLabel,
  invoiceTypeLabel,
  paymentStatusLabel,
} from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { InfoRow, SectionCard } from "@/components/dashboard/section-card";
import { InvoicePaymentPanel } from "@/components/dashboard/invoice-payment";
import { InvoiceStatusWatcher } from "@/components/dashboard/invoice-status-watcher";
import { PollRefresh } from "@/components/dashboard/poll-refresh";
import { OrderActions } from "@/components/dashboard/order-actions";
import { VerificationRequired } from "@/components/dashboard/verification-required";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Detail Invoice" };

type GatewayDisplay = {
  subtotal: number;
  feeCustomer: number;
  feeMerchant: number;
  total: number;
  method?: string;
  paymentName?: string;
  reference?: string;
  status?: string;
};

const tripayDisplayStatus: Record<string, { status: string; label: string }> = {
  FAILED: { status: "failed", label: "Gagal" },
  EXPIRED: { status: "expired", label: "Kedaluwarsa" },
  PAID: { status: "paid", label: "Lunas" },
  REFUND: { status: "refunded", label: "Dikembalikan" },
  UNPAID: { status: "unpaid", label: "Menunggu Pembayaran" },
  PENDING: { status: "unpaid", label: "Menunggu Pembayaran" },
};

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readGateway(value: unknown): GatewayDisplay | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const amount =
    numberValue(row.amount) ?? numberValue(row.total_amount) ?? numberValue(row.total) ?? 0;
  const feeCustomer = numberValue(row.feeCustomer) ?? numberValue(row.fee_customer) ?? 0;
  const feeMerchant = numberValue(row.feeMerchant) ?? numberValue(row.fee_merchant) ?? 0;
  const subtotal =
    numberValue(row.subtotal) ??
    numberValue(row.amountReceived) ??
    numberValue(row.amount_received) ??
    Math.max(0, amount - feeCustomer);
  const total = numberValue(row.total) ?? amount ?? subtotal + feeCustomer;
  if (!subtotal && !total) return null;
  return {
    subtotal,
    feeCustomer,
    feeMerchant,
    total: total || subtotal + feeCustomer,
    method: stringValue(row.method),
    paymentName: stringValue(row.paymentName) ?? stringValue(row.payment_name),
    reference: stringValue(row.reference),
    status: stringValue(row.status),
  };
}

function readPaymentGateway(raw: Record<string, unknown> | null | undefined): GatewayDisplay | null {
  if (!raw) return null;
  const direct = readGateway(raw.gateway);
  if (direct) return direct;
  return readGateway(raw.data);
}

function ProgressStep({
  state,
  title,
  description,
}: {
  state: "done" | "active" | "pending" | "failed";
  title: string;
  description: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border p-3",
        state === "done" && "border-[#BFE3CC] bg-[#F3F9F5]",
        state === "active" && "border-[#FDE68A] bg-[#FFFBEB]",
        state === "failed" && "border-[#FECACA] bg-[#FEF2F2]",
        state === "pending" && "border-[#E3E8E4] bg-[#FBFCFB]",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
          state === "done" && "bg-[#DCF2E4] text-[#15803D]",
          state === "active" && "bg-[#FEF3C7] text-[#B45309]",
          state === "failed" && "bg-[#FEE2E2] text-[#B91C1C]",
          state === "pending" && "bg-[#F1F3F2] text-[#8A9A90]",
        )}
      >
        {state === "done" ? (
          <Check className="size-4" />
        ) : state === "failed" ? (
          <XCircle className="size-4" />
        ) : state === "active" ? (
          <Clock3 className="size-4" />
        ) : (
          <Circle className="size-3.5" />
        )}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-[#101613]">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[#5B6B60]">{description}</p>
      </div>
    </div>
  );
}

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ baru?: string; dibayar?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { baru, dibayar } = await searchParams;
  const verified = isUserVerified(user);

  const invoice = db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, user.id)))
    .get();
  if (!invoice) notFound();

  const order = invoice.orderId
    ? db.select().from(orders).where(eq(orders.id, invoice.orderId)).get()
    : null;
  const service = invoice.serviceId
    ? db.select().from(services).where(eq(services.id, invoice.serviceId)).get()
    : invoice.orderId
      ? db.select().from(services).where(eq(services.orderId, invoice.orderId)).get()
      : null;
  const paymentRows = db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoice.id))
    .orderBy(desc(payments.createdAt))
    .all();
  const pendingPayment = paymentRows.find((payment) => payment.status === "pending");
  const lastTripayPayment = paymentRows.find((payment) => payment.provider === "tripay") ?? null;
  const lastOnlineFailed =
    invoice.status === "unpaid" && lastTripayPayment?.status === "failed";
  const providers = availableProviders();
  const tripayChannels = await listTripayChannels();
  const bank = manualBankDetails();
  const snapshot = order?.priceSnapshot ?? null;
  const meta = invoice.metadata ?? {};
  const planName =
    (typeof meta.planName === "string" && meta.planName) ||
    snapshot?.planName ||
    (invoice.type === "topup" ? "Top up saldo" : "Layanan VPS");
  const cycle = typeof meta.cycle === "string" ? meta.cycle : snapshot?.cycle;
  const paid = invoice.status === "paid";
  const refunded = invoice.status === "refunded";
  const settled = paid || refunded;
  const serviceFailed = Boolean(
    service &&
      (service.status === "failed" ||
        (service.status === "terminated" &&
          Boolean(order && ["failed", "cancelled"].includes(order.status)))),
  );
  const serviceVisible = service
    ? isServiceVisible(service.status, order?.status ?? null)
    : false;
  const provisioningActive = Boolean(service && service.status === "provisioning");
  const failureDetail =
    order?.errorMessage?.trim() ||
    "Penyedia cloud belum berhasil membuat VPS untuk pesanan ini.";
  const paidBannerText =
    invoice.type === "topup"
      ? "Saldo sudah ditambahkan dan siap digunakan."
      : service?.status === "active"
        ? invoice.type === "renewal"
          ? "Masa aktif layanan sudah diperpanjang."
          : invoice.type === "upgrade"
            ? "Paket VPS sudah ditingkatkan."
            : "VPS sudah aktif dan siap digunakan."
        : "Pembayaran diterima. Server sedang disiapkan dan halaman ini diperbarui otomatis.";
  const gateway =
    invoice.paymentProvider === "tripay" ? readGateway(meta.tripay) : null;
  const lastOnlineGatewayStatus = gateway?.status?.toUpperCase() ?? null;
  const useGatewayStatus =
    !settled &&
    Boolean(lastOnlineGatewayStatus) &&
    (invoice.status === "unpaid" ||
      lastOnlineGatewayStatus === "FAILED" ||
      lastOnlineGatewayStatus === "EXPIRED");
  const displayStatus =
    useGatewayStatus && lastOnlineGatewayStatus
      ? (tripayDisplayStatus[lastOnlineGatewayStatus] ?? {
          status: invoice.status,
          label: invoiceStatusLabel[invoice.status],
        })
      : { status: invoice.status, label: invoiceStatusLabel[invoice.status] };
  const displaySubtotal =
    gateway?.subtotal && gateway.subtotal > 0 ? gateway.subtotal : invoice.amount;
  const displayFee = gateway?.feeCustomer ?? 0;
  const displayTotal =
    gateway?.total && gateway.total > 0
      ? Math.max(gateway.total, displaySubtotal + displayFee)
      : displaySubtotal + displayFee;
  const totalDisplay = refunded ? invoice.amount : displayTotal;
  const paymentLabel =
    gateway?.paymentName ||
    gateway?.method ||
    (invoice.paymentProvider === "manual"
      ? "Transfer BANK"
      : invoice.paymentProvider === "balance"
        ? "Saldo akun"
        : invoice.paymentProvider === "tripay"
          ? "Pembayaran online"
          : null);
  const cycleText = cycle && cycleLabel[cycle] ? cycleLabel[cycle] : "Layanan";
  const subtitle =
    invoice.type === "topup"
      ? "Saldo otomatis masuk setelah pembayaran dikonfirmasi."
      : service
        ? `${service.hostname} · ${cycleText}`
        : snapshot
          ? `${snapshot.planName} · ${cycleText}`
          : "Layanan VPS yang aktif otomatis setelah pembayaran.";
  const paymentStep: "done" | "active" | "failed" =
    settled
      ? "done"
      : lastOnlineFailed
        ? "failed"
        : invoice.status === "expired" || invoice.status === "cancelled"
          ? "failed"
          : "active";
  const serviceStep: "done" | "active" | "pending" | "failed" =
    serviceFailed
      ? "failed"
      : refunded
        ? "done"
        : invoice.type === "topup"
          ? paid
            ? "done"
            : "pending"
          : service?.status === "active"
            ? "done"
            : service?.status === "failed" || service?.status === "terminated"
              ? "failed"
              : service?.status === "provisioning" || paid
                ? "active"
                : "pending";
  const paymentStepTitle = settled
    ? "Pembayaran diterima"
    : lastOnlineFailed
      ? "Pembayaran online belum berhasil"
      : invoice.status === "cancelled"
        ? "Pembayaran dibatalkan"
        : invoice.status === "expired"
          ? "Pembayaran kedaluwarsa"
          : "Menunggu pembayaran";
  const paymentStepDescription = paid
    ? formatDateTime(invoice.paidAt)
    : refunded
      ? `Dibayar ${formatDateTime(invoice.paidAt)} · dana dikembalikan ke saldo`
      : lastOnlineFailed
        ? "Invoice masih aktif. Coba lagi atau pilih metode pembayaran lain."
        : invoice.status === "cancelled"
          ? "Invoice dibatalkan sebelum pembayaran."
          : invoice.status === "expired"
            ? "Buat invoice baru untuk melanjutkan"
            : `Batas ${formatDateTime(invoice.dueDate)}`;
  const serviceStepTitle = serviceFailed
    ? "VPS gagal dibuat"
    : refunded
      ? "Dana dikembalikan"
      : invoice.type === "topup"
        ? paid
          ? "Saldo ditambahkan"
          : "Saldo bertambah otomatis"
        : service?.status === "active"
          ? "Layanan aktif"
          : service?.status === "failed" || service?.status === "terminated"
            ? "Layanan perlu tindakan"
            : service?.status === "provisioning"
              ? "Server disiapkan"
              : paid
                ? "Layanan diproses"
                : "Layanan disiapkan";
  const serviceStepDescription = serviceFailed
    ? refunded
      ? "Dana sudah dikembalikan ke saldo akun."
      : "Coba lagi atau ajukan refund dari halaman ini."
    : refunded
      ? "Saldo akun sudah ditambahkan kembali."
      : invoice.type === "topup"
        ? paid
          ? "Saldo siap digunakan."
          : "Setelah pembayaran terkonfirmasi."
        : service?.status === "active"
          ? `${service.hostname} siap digunakan.`
          : service?.status === "provisioning"
            ? "Server sedang disiapkan otomatis."
            : service?.status === "failed" || service?.status === "terminated"
              ? "Hubungi support untuk bantuan."
              : paid
                ? "Server akan segera disiapkan."
                : "Aktif otomatis begitu pembayaran masuk.";

  return (
    <div className="space-y-6">
      <PollRefresh enabled={provisioningActive} intervalMs={7000} />
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Invoice", href: "/dashboard/invoices" },
          { label: invoice.invoiceNumber },
        ]}
        title={`Invoice ${invoice.invoiceNumber}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={displayStatus.status} label={displayStatus.label} />
            <span>{invoiceTypeLabel[invoice.type]} · dibuat {formatDateTime(invoice.createdAt)}</span>
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
              <Link href="/dashboard/invoices">
                <ArrowLeft className="size-4" /> Kembali
              </Link>
            </Button>
            {settled ? (
              <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
                <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
                  <Download className="size-4" /> Unduh PDF
                </a>
              </Button>
            ) : null}
          </>
        }
      />

      {serviceFailed ? (
        <section className="overflow-hidden rounded-2xl border border-[#FECACA] bg-[#FEF2F2]">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#B91C1C]">
                <CircleAlert className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#991B1B]">VPS gagal dibuat</p>
                <p className="mt-1 text-sm leading-relaxed text-[#991B1B]/80">
                  {failureDetail}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[#991B1B]/70">
                  {refunded
                    ? `Dana ${formatIDR(invoice.amount)} sudah dikembalikan ke saldo akun. Kamu tetap berada di halaman invoice ini.`
                    : "Kamu tetap berada di halaman invoice ini. Coba buat server lagi atau ajukan refund tanpa kehilangan detail pembayaran."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {refunded ? (
                    <Button asChild size="sm" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                      <Link href="/dashboard/saldo">Lihat saldo</Link>
                    </Button>
                  ) : order ? (
                    <OrderActions
                      orderId={order.id}
                      status={order.status}
                      orderNumber={order.orderNumber}
                      hasRefund={refunded}
                    />
                  ) : null}
                  {order ? (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="border-[#FECACA] bg-white text-[#991B1B] hover:bg-[#FEE2E2]"
                    >
                      <Link href={`/dashboard/pesanan/${order.id}`}>Detail pesanan</Link>
                    </Button>
                  ) : null}
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="border-[#FECACA] bg-white text-[#991B1B] hover:bg-[#FEE2E2]"
                  >
                    <Link href={`/dashboard/tiket/baru?invoice=${invoice.invoiceNumber}`}>
                      Buka tiket
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {dibayar && settled && !serviceFailed ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#BFE3CC] bg-[#F3F9F5] p-4">
          <CheckCircle2 className="mt-0.5 size-5 text-[#16A34A]" />
          <div>
            <p className="text-sm font-bold text-[#0B3D2E]">Pembayaran berhasil diterima</p>
            <p className="text-xs leading-relaxed text-[#5B6B60]">{paidBannerText}</p>
          </div>
        </div>
      ) : null}

      {baru && invoice.status === "unpaid" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#BFE3CC] bg-[#F3F9F5] p-4">
          <CheckCircle2 className="mt-0.5 size-5 text-[#16A34A]" />
          <div>
            <p className="text-sm font-bold text-[#0B3D2E]">Pesanan berhasil dibuat</p>
            <p className="text-xs text-[#5B6B60]">
              Selesaikan pembayaran di bawah. Setelah terkonfirmasi, server diproses otomatis.
            </p>
          </div>
        </div>
      ) : null}

      {invoice.status === "unpaid" || invoice.status === "expired" ? (
        <InvoiceStatusWatcher
          invoiceId={invoice.id}
          status={invoice.status}
          paymentStatus={lastTripayPayment?.status ?? null}
        />
      ) : null}

      <section className="relative overflow-hidden rounded-3xl border border-[#0B3D2E]/10 bg-gradient-to-br from-[#082E22] via-[#0B3D2E] to-[#145A42] p-6 text-white shadow-[0_30px_80px_-40px_rgba(11,61,46,0.9)] sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-[#7FE0B0]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 size-72 rounded-full bg-white/5 blur-3xl" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-[#A7D8BD] uppercase">
              <Receipt className="size-4" />
              {invoiceTypeLabel[invoice.type]}
              <span className="size-1 rounded-full bg-[#A7D8BD]/60" />
              <span className="font-mono tracking-normal">{invoice.invoiceNumber}</span>
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {planName}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#C7E3D4]">{subtitle}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                  displayStatus.status === "paid" || displayStatus.status === "refunded"
                    ? "border-[#86EFAC]/30 bg-[#86EFAC]/15 text-[#BBF7D0]"
                    : displayStatus.status === "expired" ||
                        displayStatus.status === "cancelled" ||
                        displayStatus.status === "failed"
                      ? "border-[#FCA5A5]/30 bg-[#FCA5A5]/15 text-[#FECACA]"
                      : "border-[#FDE68A]/30 bg-[#FDE68A]/15 text-[#FEF3C7]",
                )}
              >
                {displayStatus.status === "paid" ? (
                  <CheckCircle2 className="size-3.5" />
                ) : displayStatus.status === "refunded" ? (
                  <RotateCcw className="size-3.5" />
                ) : displayStatus.status === "expired" ||
                  displayStatus.status === "cancelled" ||
                  displayStatus.status === "failed" ? (
                  <XCircle className="size-3.5" />
                ) : (
                  <Clock3 className="size-3.5" />
                )}
                {displayStatus.label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-[#D7EFE2]">
                <CalendarClock className="size-3.5 text-[#A7D8BD]" />
                Jatuh tempo {formatDateTime(invoice.dueDate)}
              </span>
              {paymentLabel ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-[#D7EFE2]">
                  <CreditCard className="size-3.5 text-[#A7D8BD]" />
                  {paymentLabel}
                </span>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur-sm lg:min-w-[280px] lg:text-right">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#A7D8BD] uppercase">
              {paid
                ? "Total dibayar"
                : refunded
                  ? "Total dikembalikan"
                  : displayFee > 0
                    ? "Total pembayaran online"
                    : "Total tagihan"}
            </p>
            <p className="mt-1 font-display text-4xl font-bold tracking-tight">
              {formatIDR(totalDisplay)}
            </p>
            {refunded ? (
              <p className="mt-1 text-xs text-[#C7E3D4]">Dikembalikan ke saldo akun</p>
            ) : displayFee > 0 ? (
              <p className="mt-1 text-xs text-[#C7E3D4]">
                Termasuk biaya layanan {formatIDR(displayFee)}
              </p>
            ) : (
              <p className="mt-1 text-xs text-[#C7E3D4]">Tanpa biaya tambahan</p>
            )}
            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="text-[11px] text-[#A7D8BD]">
                {settled
                  ? `Dibayar ${formatDateTime(invoice.paidAt)}`
                  : `Batas pembayaran ${formatDateTime(invoice.dueDate)}`}
              </p>
            </div>
          </div>
        </div>

        {displayFee > 0 ? (
          <div className="relative mt-6 grid gap-2 border-t border-white/10 pt-5 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-[#A7D8BD] uppercase">
                Subtotal
              </p>
              <p className="mt-1 text-sm font-bold text-white">{formatIDR(displaySubtotal)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-[#A7D8BD] uppercase">
                Biaya layanan
              </p>
              <p className="mt-1 text-sm font-bold text-white">{formatIDR(displayFee)}</p>
            </div>
            <div className="rounded-xl border border-[#86EFAC]/20 bg-[#86EFAC]/10 px-3.5 py-3">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-[#BBF7D0] uppercase">
                Total
              </p>
              <p className="mt-1 text-sm font-bold text-white">{formatIDR(displayTotal)}</p>
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <SectionCard title="Rincian tagihan">
            <div className="grid gap-2 sm:grid-cols-3">
              <ProgressStep
                state="done"
                title="Invoice dibuat"
                description={formatDateTime(invoice.createdAt)}
              />
              <ProgressStep
                state={paymentStep}
                title={paymentStepTitle}
                description={paymentStepDescription}
              />
              <ProgressStep
                state={serviceStep}
                title={serviceStepTitle}
                description={serviceStepDescription}
              />
            </div>

            <div className="mt-5 rounded-xl border border-[#EDF1EE] bg-[#FBFCFB] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#101613]">
                    {invoice.type === "topup" ? "Top up saldo" : planName}
                  </p>
                  <p className="mt-0.5 text-xs text-[#5B6B60]">{subtitle}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-[#8A9A90] uppercase">
                    Subtotal
                  </p>
                  <p className="font-display text-xl font-bold text-[#0B3D2E]">
                    {formatIDR(displaySubtotal)}
                  </p>
                </div>
              </div>
              {snapshot || displayFee > 0 ? (
                <dl className="mt-4 space-y-1.5 border-t border-[#EDF1EE] pt-3 text-xs">
                  {snapshot && (snapshot.setupFee > 0 || snapshot.discount > 0) ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#5B6B60]">Harga paket</dt>
                      <dd className="font-semibold text-[#101613]">{formatIDR(snapshot.subtotal)}</dd>
                    </div>
                  ) : null}
                  {snapshot && snapshot.setupFee > 0 ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#5B6B60]">Biaya setup</dt>
                      <dd className="font-semibold text-[#101613]">{formatIDR(snapshot.setupFee)}</dd>
                    </div>
                  ) : null}
                  {snapshot && snapshot.discount > 0 ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#5B6B60]">Diskon {snapshot.promoCode ?? ""}</dt>
                      <dd className="font-semibold text-[#15803D]">−{formatIDR(snapshot.discount)}</dd>
                    </div>
                  ) : null}
                  {displayFee > 0 ? (
                    <>
                      <div className="flex justify-between gap-3">
                        <dt className="text-[#5B6B60]">Biaya layanan</dt>
                        <dd className="font-semibold text-[#101613]">+{formatIDR(displayFee)}</dd>
                      </div>
                      <div className="flex justify-between gap-3 border-t border-dashed border-[#D8E2DB] pt-2">
                        <dt className="font-semibold text-[#0B3D2E]">Total pembayaran online</dt>
                        <dd className="font-bold text-[#0B3D2E]">{formatIDR(displayTotal)}</dd>
                      </div>
                    </>
                  ) : null}
                </dl>
              ) : null}
              {displayFee > 0 ? (
                <p className="mt-3 text-[11px] leading-relaxed text-[#8A9A90]">
                  Biaya layanan tergantung metode pembayaran online. Kalau pakai saldo atau
                  transfer bank, kamu cukup bayar subtotal.
                </p>
              ) : null}
            </div>

            <dl className="mt-4 divide-y divide-[#EDF1EE]">
              <InfoRow label="Nomor invoice" value={<span className="font-mono text-xs">{invoice.invoiceNumber}</span>} />
              <InfoRow label="Jenis" value={invoiceTypeLabel[invoice.type]} />
              <InfoRow label="Dibuat" value={formatDateTime(invoice.createdAt)} />
              <InfoRow label="Jatuh tempo" value={formatDateTime(invoice.dueDate)} />
              {settled ? <InfoRow label="Dibayar" value={formatDateTime(invoice.paidAt)} /> : null}
              {invoice.paymentProvider ? (
                <InfoRow
                  label="Metode"
                  value={
                    paymentLabel ??
                    (invoice.paymentProvider === "manual" ? "Transfer BANK" : "Pembayaran online")
                  }
                />
              ) : null}
              {gateway?.reference ? (
                <InfoRow
                  label="Referensi pembayaran"
                  value={<span className="font-mono text-xs">{gateway.reference}</span>}
                />
              ) : null}
              {order ? (
                <InfoRow
                  label="Pesanan"
                  value={
                    <Link href={`/dashboard/pesanan/${order.id}`} className="text-[#0B3D2E] hover:underline">
                      {order.orderNumber}
                    </Link>
                  }
                />
              ) : null}
              {service ? (
                <InfoRow
                  label="Layanan"
                  value={
                    serviceVisible ? (
                      <Link
                        href={`/dashboard/vps/${service.id}`}
                        className="inline-flex items-center gap-1 text-[#0B3D2E] hover:underline"
                      >
                        <Server className="size-3.5" /> {service.hostname}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#991B1B]">
                        <Server className="size-3.5" /> {service.hostname} ·{" "}
                        {serviceFailed ? "gagal dibuat" : "tidak aktif"}
                      </span>
                    )
                  }
                />
              ) : null}
            </dl>

            {refunded && !serviceFailed ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#BFE3CC] bg-[#F3F9F5] p-4 text-sm text-[#0B3D2E]">
                <RotateCcw className="size-4" /> Dana invoice ini sudah dikembalikan ke saldo akun.
              </div>
            ) : paid && !serviceFailed ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#BFE3CC] bg-[#F3F9F5] p-4 text-sm text-[#0B3D2E]">
                <CheckCircle2 className="size-4" /> Invoice sudah lunas. Terima kasih!
              </div>
            ) : invoice.status === "cancelled" ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#E3E8E4] bg-[#F7F8F7] p-4 text-sm text-[#5B6B60]">
                <XCircle className="size-4" /> Invoice dibatalkan.
              </div>
            ) : invoice.status === "expired" ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#92400E]">
                <XCircle className="size-4" /> Invoice sudah kedaluwarsa karena lewat batas 30 menit.
                Buat pesanan atau top up baru, yuk.
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Riwayat pembayaran" description="Percobaan pembayaran untuk invoice ini." bodyClassName="p-0">
            {paymentRows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#5B6B60]">Belum ada pembayaran.</p>
            ) : (
              <ul className="divide-y divide-[#EDF1EE]">
                {paymentRows.map((payment) => {
                  const paymentGateway = readPaymentGateway(payment.rawWebhook);
                  const paymentMethod =
                    payment.provider === "manual"
                      ? "Transfer BANK"
                      : payment.provider === "balance"
                        ? "Saldo akun"
                        : paymentGateway?.paymentName ||
                          paymentGateway?.method ||
                          (payment.method && payment.method.toLowerCase() !== "tripay"
                            ? payment.method
                            : "Pembayaran online");
                  return (
                    <li
                      key={payment.id}
                      className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-[#F3F9F5] text-[#0B3D2E]">
                          <Receipt className="size-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-[#101613]">
                            {formatIDR(paymentGateway?.total ?? payment.amount)} · {paymentMethod}
                          </p>
                          {paymentGateway && paymentGateway.feeCustomer > 0 ? (
                            <p className="mt-0.5 text-[11px] text-[#5B6B60]">
                              Subtotal {formatIDR(paymentGateway.subtotal)} + biaya layanan{" "}
                              {formatIDR(paymentGateway.feeCustomer)}
                            </p>
                          ) : null}
                          <p className="text-xs text-[#8A9A90]">
                            {formatDateTime(payment.createdAt)}
                            {payment.providerRef ? ` · ${payment.providerRef}` : ""}
                          </p>
                          {payment.rejectionReason ? (
                            <p className="mt-1 text-xs text-[#B91C1C]">
                              Ditolak: {payment.rejectionReason}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        {payment.proofUrl ? (
                          <Button asChild variant="ghost" size="xs" className="text-[#0B3D2E]">
                            <a
                              href={`/api/payments/${payment.id}/proof`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <FileText className="size-3.5" /> Bukti
                            </a>
                          </Button>
                        ) : null}
                        <StatusBadge
                          status={payment.status}
                          label={paymentStatusLabel[payment.status] ?? payment.status}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          {invoice.status === "unpaid" ? (
            <SectionCard
              title="Selesaikan pembayaran"
              description={
                displayFee > 0
                  ? `Subtotal ${formatIDR(invoice.amount)} · total online ${formatIDR(displayTotal)}`
                  : `Total ${formatIDR(invoice.amount)}`
              }
            >
              {verified ? (
                <InvoicePaymentPanel
                  invoiceId={invoice.id}
                  amount={invoice.amount}
                  gatewayFee={displayFee}
                  gatewayTotal={displayTotal}
                  status={invoice.status}
                  type={invoice.type}
                  providers={providers.map((provider) => ({
                    id: provider.id,
                    label: provider.label,
                    description: provider.description,
                  }))}
                  tripayChannels={tripayChannels}
                  balance={user.balance}
                  bank={bank}
                  hasPendingProof={Boolean(pendingPayment?.proofUrl)}
                  lastOnlineFailed={lastOnlineFailed}
                  lastOnlineStatus={lastOnlineGatewayStatus}
                />
              ) : (
                <VerificationRequired
                  title="Verifikasi akun untuk membayar invoice"
                  description="Kode verifikasi dikirim ke WhatsApp (prioritas). Setelah terverifikasi, kamu bisa melanjutkan pembayaran invoice ini."
                />
              )}
            </SectionCard>
          ) : null}

          <SectionCard title="Butuh bantuan?">
            <div className="flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
                <ShieldCheck className="size-4" />
              </span>
              <p className="text-sm leading-relaxed text-[#5B6B60]">
                Pembayaran dicek maksimal 1x24 jam di hari kerja. Kalau lebih dari itu,
                hubungi support dan sertakan nomor invoice.
              </p>
            </div>
            <Button asChild className="mt-4 w-full bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              <Link href={`/dashboard/tiket/baru?invoice=${invoice.invoiceNumber}`}>
                Buka tiket support
              </Link>
            </Button>
          </SectionCard>

          <div className="rounded-2xl border border-[#E3E8E4] bg-white p-4 text-xs leading-relaxed text-[#8A9A90]">
            <p className="flex items-center gap-1.5 font-semibold text-[#5B6B60]">
              <Info className="size-3.5" /> Catatan keamanan
            </p>
            <p className="mt-1">
              Admin nggak pernah minta password atau kode OTP. Pembayaran cuma ke rekening resmi
              yang tertera di halaman ini.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
