import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, LifeBuoy, Receipt, Server, ShoppingCart, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import {
  balanceTransactions,
  invoices,
  orders,
  services,
  tickets,
  users,
} from "@/lib/db/schema";
import { isUserVerified, requireAdmin } from "@/lib/auth";
import {
  formatDate,
  formatDateTime,
  formatIDR,
  formatRelative,
  invoiceStatusLabel,
  invoiceTypeLabel,
  orderStatusLabel,
  serviceStatusLabel,
  ticketStatusLabel,
} from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SectionCard, InfoRow } from "@/components/dashboard/section-card";
import { AdjustBalanceForm, UserAdminActions } from "@/components/dashboard/admin-user-actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Detail Pengguna" };

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const user = db.select().from(users).where(eq(users.id, id)).get();
  if (!user) notFound();

  const userServices = db
    .select()
    .from(services)
    .where(eq(services.userId, id))
    .orderBy(desc(services.createdAt))
    .all();
  const userOrders = db
    .select()
    .from(orders)
    .where(eq(orders.userId, id))
    .orderBy(desc(orders.createdAt))
    .limit(8)
    .all();
  const userInvoices = db
    .select()
    .from(invoices)
    .where(eq(invoices.userId, id))
    .orderBy(desc(invoices.createdAt))
    .limit(8)
    .all();
  const ledger = db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.userId, id))
    .orderBy(desc(balanceTransactions.createdAt))
    .limit(10)
    .all();
  const userTickets = db
    .select()
    .from(tickets)
    .where(eq(tickets.userId, id))
    .orderBy(desc(tickets.updatedAt))
    .limit(5)
    .all();

  const paidTotal = db
    .select()
    .from(invoices)
    .where(and(eq(invoices.userId, id), eq(invoices.status, "paid")))
    .all()
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const activeServices = userServices.filter((service) =>
    ["active", "provisioning", "suspended"].includes(service.status),
  ).length;
  const openTickets = userTickets.filter((ticket) => ticket.status !== "closed").length;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Pengguna", href: "/admin/users" },
          { label: user.name },
        ]}
        title={user.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{user.email}</span>
            <StatusBadge status={user.status} label={user.status === "active" ? "Aktif" : "Ditangguhkan"} />
            {user.role === "admin" ? <StatusBadge status="admin" label="Admin" tone="info" /> : null}
            {!isUserVerified(user) ? (
              <StatusBadge status="unverified" label="Belum verifikasi" tone="warning" />
            ) : null}
          </span>
        }
        actions={
          <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
            <Link href="/admin/users">
              <ArrowLeft className="size-4" /> Semua pengguna
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Saldo", value: formatIDR(user.balance), icon: Wallet },
          { label: "Layanan aktif", value: String(activeServices), icon: Server },
          { label: "Total pembayaran", value: formatIDR(paidTotal), icon: Receipt },
          { label: "Tiket terbuka", value: String(openTickets), icon: LifeBuoy },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[#E3E8E4] bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">{item.label}</p>
              <span className="flex size-8 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
                <item.icon className="size-4" />
              </span>
            </div>
            <p className="mt-2 font-display text-xl font-bold text-[#101613]">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Akun" description="Informasi profil dan keamanan akun.">
            <dl className="divide-y divide-[#EDF1EE]">
              <InfoRow label="Nama" value={user.name} />
              <InfoRow label="Email" value={user.email} hint={user.emailVerifiedAt ? `Terverifikasi ${formatDate(user.emailVerifiedAt)}` : "Belum diverifikasi"} />
              <InfoRow
                label="WhatsApp"
                value={user.phone ?? "—"}
                hint={
                  user.phoneVerifiedAt
                    ? `Terverifikasi ${formatDate(user.phoneVerifiedAt)}`
                    : user.phone
                      ? "Belum diverifikasi"
                      : undefined
                }
              />
              <InfoRow label="Role" value={user.role === "admin" ? "Admin" : "Pelanggan"} />
              <InfoRow label="Status" value={user.status === "active" ? "Aktif" : "Ditangguhkan"} />
              <InfoRow label="ID pengguna" value={<span className="font-mono text-xs">{user.id}</span>} />
              <InfoRow label="Terdaftar" value={formatDateTime(user.createdAt)} />
              <InfoRow label="Terakhir masuk" value={formatRelative(user.lastLoginAt)} hint={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : undefined} />
            </dl>
          </SectionCard>

          <SectionCard title="Tindakan admin" description="Perubahan role dan status berlaku langsung.">
            <UserAdminActions
              userId={user.id}
              role={user.role}
              status={user.status}
              isSelf={user.id === admin.id}
              verified={isUserVerified(user)}
            />
          </SectionCard>

          <SectionCard title="Penyesuaian saldo" description="Untuk kompensasi, koreksi, atau refund manual.">
            <AdjustBalanceForm userId={user.id} balance={user.balance} />
          </SectionCard>

          <SectionCard
            title="Layanan VPS"
            description={`${userServices.length} layanan terdaftar.`}
            bodyClassName="p-0"
            action={
              <Button asChild variant="outline" size="sm" className="border-[#D8E2DB] bg-white">
                <Link href={`/admin/services?q=${encodeURIComponent(user.email)}`}>Lihat semua</Link>
              </Button>
            }
          >
            {userServices.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#5B6B60]">Belum ada layanan.</p>
            ) : (
              <ul className="divide-y divide-[#EDF1EE]">
                {userServices.slice(0, 6).map((service) => (
                  <li key={service.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <div className="min-w-0">
                      <Link href={`/admin/services/${service.id}`} className="font-semibold text-[#101613] hover:text-[#0B3D2E] hover:underline">
                        {service.hostname}
                      </Link>
                      <p className="text-xs text-[#8A9A90]">
                        {service.regionSlug} · {service.ipv4 ?? "IP belum tersedia"} · s/d {formatDate(service.periodEnd)}
                      </p>
                    </div>
                    <StatusBadge status={service.status} label={serviceStatusLabel[service.status]} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Riwayat saldo" description="10 transaksi terakhir." bodyClassName="p-0">
            {ledger.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#5B6B60]">Belum ada transaksi saldo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-[#E3E8E4] bg-[#F7F8F7] text-left text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">
                      <th className="px-4 py-2.5">Waktu</th>
                      <th className="px-4 py-2.5">Jenis</th>
                      <th className="px-4 py-2.5">Nominal</th>
                      <th className="px-4 py-2.5">Saldo akhir</th>
                      <th className="px-4 py-2.5">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((entry) => (
                      <tr key={entry.id} className="border-b border-[#EDF1EE] last:border-0">
                        <td className="px-4 py-3 text-xs text-[#8A9A90]">{formatDateTime(entry.createdAt)}</td>
                        <td className="px-4 py-3 text-[#5B6B60]">{entry.type}</td>
                        <td className={`px-4 py-3 font-semibold ${entry.amount >= 0 ? "text-[#0B3D2E]" : "text-[#991B1B]"}`}>
                          {entry.amount >= 0 ? "+" : "−"}
                          {formatIDR(Math.abs(entry.amount))}
                        </td>
                        <td className="px-4 py-3 text-[#101613]">{formatIDR(entry.balanceAfter)}</td>
                        <td className="px-4 py-3 text-xs text-[#5B6B60]">{entry.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Pesanan terbaru" bodyClassName="p-0">
            {userOrders.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-[#5B6B60]">Belum ada pesanan.</p>
            ) : (
              <ul className="divide-y divide-[#EDF1EE]">
                {userOrders.map((order) => (
                  <li key={order.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/admin/orders/${order.id}`} className="font-mono text-xs font-semibold text-[#0B3D2E] hover:underline">
                        {order.orderNumber}
                      </Link>
                      <StatusBadge status={order.status} label={orderStatusLabel[order.status]} />
                    </div>
                    <p className="mt-1 text-xs text-[#8A9A90]">
                      {order.hostname} · {formatDateTime(order.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Invoice terbaru" bodyClassName="p-0">
            {userInvoices.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-[#5B6B60]">Belum ada invoice.</p>
            ) : (
              <ul className="divide-y divide-[#EDF1EE]">
                {userInvoices.map((invoice) => (
                  <li key={invoice.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/admin/invoices/${invoice.id}`} className="font-mono text-xs font-semibold text-[#0B3D2E] hover:underline">
                        {invoice.invoiceNumber}
                      </Link>
                      <StatusBadge status={invoice.status} label={invoiceStatusLabel[invoice.status]} />
                    </div>
                    <p className="mt-1 text-xs text-[#8A9A90]">
                      {invoiceTypeLabel[invoice.type]} · {formatIDR(invoice.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Tiket terbaru" bodyClassName="p-0">
            {userTickets.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-[#5B6B60]">Belum ada tiket.</p>
            ) : (
              <ul className="divide-y divide-[#EDF1EE]">
                {userTickets.map((ticket) => (
                  <li key={ticket.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/admin/tickets/${ticket.id}`} className="text-xs font-semibold text-[#101613] hover:text-[#0B3D2E] hover:underline">
                        {ticket.subject}
                      </Link>
                      <StatusBadge status={ticket.status} label={ticketStatusLabel[ticket.status]} />
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-[#8A9A90]">{ticket.ticketNumber}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Akses cepat" bodyClassName="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start border-[#D8E2DB] bg-white">
              <Link href={`/admin/orders?q=${encodeURIComponent(user.email)}`}>
                <ShoppingCart className="size-4" /> Pesanan pengguna
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start border-[#D8E2DB] bg-white">
              <Link href={`/admin/invoices?q=${encodeURIComponent(user.email)}`}>
                <Receipt className="size-4" /> Invoice pengguna
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start border-[#D8E2DB] bg-white">
              <Link href="/admin/payments">
                <Wallet className="size-4" /> Verifikasi pembayaran
              </Link>
            </Button>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
