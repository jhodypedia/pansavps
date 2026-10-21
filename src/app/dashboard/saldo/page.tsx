import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Receipt, Wallet } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { balanceTransactions, invoices } from "@/lib/db/schema";
import { isUserVerified, requireUser } from "@/lib/auth";
import { listTripayChannels } from "@/lib/payments/tripay";
import { formatDateTime, formatIDR } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { TopupQuickAmounts } from "@/components/dashboard/invoice-payment";
import { VerificationRequired } from "@/components/dashboard/verification-required";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Saldo" };

const typeLabels: Record<string, string> = {
  topup: "Top up",
  payment: "Pembayaran",
  refund: "Refund",
  adjustment: "Penyesuaian",
};

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
  const totalIn = transactions.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
  const totalOut = transactions.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saldo akun"
        description="Top up saldo untuk membayar pesanan, perpanjangan, dan upgrade secara instan."
        actions={
          <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
            <Link href="/dashboard/invoices">
              <Receipt className="size-4" /> Semua invoice
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Saldo tersedia" value={formatIDR(user.balance)} icon={Wallet} tone="brand" />
        <StatCard label="Total masuk" value={formatIDR(totalIn)} icon={ArrowDownLeft} tone="mint" />
        <StatCard label="Total terpakai" value={formatIDR(totalOut)} icon={ArrowUpRight} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <SectionCard title="Top up saldo" description="Pilih nominal, lalu selesaikan pembayaran.">
            {verified ? (
              <TopupQuickAmounts disabled={false} tripayChannels={tripayChannels} />
            ) : (
              <VerificationRequired
                title="Verifikasi akun untuk top up saldo"
                description="Kode verifikasi dikirim ke WhatsApp (prioritas). Setelah terverifikasi, kamu bisa top up saldo dan membayar pesanan."
              />
            )}
          </SectionCard>

          {pendingTopups.length > 0 ? (
            <SectionCard title="Top up menunggu pembayaran" bodyClassName="p-0">
              <ul className="divide-y divide-[#EDF1EE]">
                {pendingTopups.map((invoice) => (
                  <li key={invoice.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div>
                      <p className="text-sm font-bold text-[#101613]">{formatIDR(invoice.amount)}</p>
                      <p className="text-xs text-[#8A9A90]">
                        {invoice.invoiceNumber} · {formatDateTime(invoice.createdAt)}
                      </p>
                    </div>
                    <Button asChild size="sm" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                      <Link href={`/dashboard/invoices/${invoice.id}`}>Bayar</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}
        </div>

        <SectionCard title="Riwayat transaksi" description="Mutasi saldo akun kamu." bodyClassName="p-0">
          {transactions.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-[#5B6B60]">
              Belum ada transaksi. Saldo akan muncul setelah top up atau refund.
            </p>
          ) : (
            <ul className="divide-y divide-[#EDF1EE]">
              {transactions.map((tx) => (
                <li key={tx.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                      tx.amount > 0 ? "bg-[#E7F4EC] text-[#15803D]" : "bg-[#FEF3C7] text-[#92400E]",
                    )}
                  >
                    {tx.amount > 0 ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#101613]">{typeLabels[tx.type] ?? tx.type}</p>
                      <p className={cn("text-sm font-bold", tx.amount > 0 ? "text-[#15803D]" : "text-[#991B1B]")}>
                        {tx.amount > 0 ? "+" : ""}
                        {formatIDR(tx.amount)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-[#8A9A90]">
                      {tx.note ?? tx.ref ?? "—"} · {formatDateTime(tx.createdAt)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#8A9A90]">
                      Saldo setelah transaksi: {formatIDR(tx.balanceAfter)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="rounded-2xl border border-[#E3E8E4] bg-white p-5 text-sm leading-relaxed text-[#5B6B60]">
        <p className="font-bold text-[#101613]">Ketentuan saldo</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
          <li>Saldo hanya dapat digunakan untuk layanan di toko ini dan tidak dapat dipindahkan ke pengguna lain.</li>
          <li>Refund pesanan gagal dikembalikan sebagai saldo setelah ditinjau tim billing.</li>
          <li>Top up manual diverifikasi maksimal 1x24 jam pada hari kerja.</li>
        </ul>
      </div>
    </div>
  );
}
