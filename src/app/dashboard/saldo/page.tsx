import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Plus,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { balanceTransactions, invoices } from "@/lib/db/schema";
import { isUserVerified, requireUser } from "@/lib/auth";
import { listTripayChannels } from "@/lib/payments/tripay";
import { formatDateTime, formatIDR } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { BalanceHistory } from "@/components/dashboard/balance-history";
import { TopupQuickAmounts } from "@/components/dashboard/invoice-payment";
import { VerificationRequired } from "@/components/dashboard/verification-required";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

export const metadata = { title: "Saldo" };

export default async function BalancePage() {
  const user = await requireUser();
  const verified = isUserVerified(user);
  const tripayChannels = await listTripayChannels();
  const transactions = db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.userId, user.id))
    .orderBy(desc(balanceTransactions.createdAt))
    .all();
  const pendingTopups = db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.userId, user.id),
        eq(invoices.type, "topup"),
        eq(invoices.status, "unpaid"),
      ),
    )
    .orderBy(desc(invoices.createdAt))
    .all();
  const refundedInvoiceIds = new Set(
    db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.userId, user.id), eq(invoices.status, "refunded")))
      .all()
      .map((invoice) => invoice.id),
  );

  const totalTopup = transactions
    .filter((tx) => tx.type === "topup" && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);
  // Pembayaran yang sudah direfund tidak dihitung sebagai pemakaian saldo.
  const totalSpent = transactions
    .filter(
      (tx) =>
        tx.type === "payment" &&
        tx.amount < 0 &&
        !(tx.ref && refundedInvoiceIds.has(tx.ref)),
    )
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const pendingTopupTotal = pendingTopups.reduce((sum, invoice) => sum + invoice.amount, 0);
  const historyItems = transactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    balanceAfter: tx.balanceAfter,
    ref: tx.ref,
    note: tx.note,
    createdAt: tx.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saldo akun"
        description="Pantau saldo, isi ulang, dan lihat semua mutasi dalam satu tempat."
        actions={
          <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
            <Link href="/dashboard/invoices">
              <Receipt className="size-4" /> Semua invoice
            </Link>
          </Button>
        }
      />

      <section className="relative overflow-hidden rounded-3xl border border-[#0B3D2E] bg-[#06231A] text-white shadow-[0_28px_80px_-48px_rgba(11,61,46,0.9)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "linear-gradient(to bottom right, black, transparent 85%)",
            WebkitMaskImage: "linear-gradient(to bottom right, black, transparent 85%)",
          }}
          aria-hidden
        />
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                <Wallet className="size-3.5 text-[#86EFAC]" /> Saldo tersedia
              </span>
              <p className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
                {formatIDR(user.balance)}
              </p>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/65">
                Bisa dipakai untuk pesanan baru, perpanjangan, dan upgrade. Refund yang disetujui
                masuk ke saldo akun dan tercatat di riwayat.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button asChild className="bg-white text-[#0B3D2E] hover:bg-[#E7F4EC]">
                  <Link href="#topup">
                    <Plus className="size-4" /> Top up saldo
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/dashboard/pesanan/baru">
                    Pesan VPS <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="lg:w-[360px]">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Top up berhasil" value={formatIDR(totalTopup)} icon={ArrowDownLeft} />
                <MiniStat label="Pembayaran VPS" value={formatIDR(totalSpent)} icon={CreditCard} />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-white/45 lg:text-right">
                Refund dan penyesuaian tidak dihitung sebagai pemakaian. Detailnya ada di riwayat.
              </p>
            </div>
          </div>
        </div>
      </section>

      {pendingTopups.length > 0 ? (
        <section className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[#92400E]">Top up menunggu pembayaran</p>
              <p className="mt-0.5 text-xs text-[#92400E]/75">
                Selesaikan pembayaran agar saldo segera ditambahkan.
              </p>
            </div>
            <span className="text-sm font-bold text-[#92400E]">{formatIDR(pendingTopupTotal)}</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {pendingTopups.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#FDE68A] bg-white p-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#101613]">{formatIDR(invoice.amount)}</p>
                  <p className="mt-0.5 truncate text-xs text-[#8A9A90]">
                    {invoice.invoiceNumber} · {formatDateTime(invoice.createdAt)}
                  </p>
                </div>
                <Button asChild size="sm" className="shrink-0 bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                  <Link href={`/dashboard/invoices/${invoice.id}`}>Bayar</Link>
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div id="topup">
            <SectionCard
              title="Top up saldo"
              description="Pilih nominal, lalu selesaikan pembayaran. Saldo masuk otomatis setelah terverifikasi."
            >
              {verified ? (
                <TopupQuickAmounts disabled={false} tripayChannels={tripayChannels} />
              ) : (
                <VerificationRequired
                  title="Verifikasi akun untuk top up saldo"
                  description="Kode verifikasi dikirim ke WhatsApp (prioritas). Setelah terverifikasi, kamu bisa top up saldo dan membayar pesanan."
                />
              )}
            </SectionCard>
          </div>

          <div className="rounded-2xl border border-[#E3E8E4] bg-white p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-[#0B3D2E]" />
              <p className="text-sm font-bold text-[#101613]">Ketentuan saldo</p>
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-[#5B6B60]">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#16A34A]" />
                Saldo hanya dapat digunakan untuk layanan di toko ini dan tidak dapat dipindahkan ke
                pengguna lain.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#16A34A]" />
                Refund yang disetujui dikembalikan ke saldo dan tidak dihitung sebagai pemakaian.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#16A34A]" />
                Top up manual diverifikasi maksimal 1x24 jam pada hari kerja.
              </li>
            </ul>
          </div>
        </div>

        <SectionCard
          title="Riwayat transaksi"
          description="Semua mutasi saldo, termasuk top up, pembayaran, dan refund."
          bodyClassName="p-0"
        >
          <BalanceHistory items={historyItems} />
        </SectionCard>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 backdrop-blur-sm">
      <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-[#86EFAC]">
        <Icon className="size-4" />
      </span>
      <p className="mt-2.5 text-[11px] font-medium text-white/55">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-white">{value}</p>
    </div>
  );
}
