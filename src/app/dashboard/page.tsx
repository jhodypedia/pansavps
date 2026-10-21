import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  Clock,
  Cpu,
  CreditCard,
  Globe2,
  HardDrive,
  LifeBuoy,
  Plus,
  Receipt,
  Server,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  invoices,
  orders,
  plans,
  regions,
  tickets,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { listVisibleUserServices } from "@/server/services/services";
import { getPublicBrand } from "@/lib/settings";
import {
  cycleLabel,
  formatDateTime,
  formatIDR,
  formatRelative,
  orderStatusLabel,
  serviceStatusLabel,
  ticketStatusLabel,
} from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata = { title: "Ringkasan" };

export default async function DashboardPage() {
  const user = await requireUser();
  const brand = getPublicBrand();

  const myServices = listVisibleUserServices(user.id);
  const planRows = db.select().from(plans).all();
  const planMap = new Map(planRows.map((plan) => [plan.id, plan]));
  const regionRows = db.select().from(regions).all();
  const regionMap = new Map(regionRows.map((region) => [region.slug, region]));

  const unpaid = db
    .select()
    .from(invoices)
    .where(and(eq(invoices.userId, user.id), eq(invoices.status, "unpaid")))
    .orderBy(invoices.dueDate)
    .all();
  const unpaidTotal = unpaid.reduce((sum, invoice) => sum + invoice.amount, 0);

  const openTickets = db
    .select()
    .from(tickets)
    .where(and(eq(tickets.userId, user.id), ne(tickets.status, "closed")))
    .orderBy(desc(tickets.updatedAt))
    .all();

  const recentOrders = db
    .select()
    .from(orders)
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt))
    .limit(5)
    .all();

  const activeIds = myServices
    .filter((service) => service.status !== "terminated")
    .map((service) => service.id);
  const upcoming = activeIds.length
    ? db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.userId, user.id),
            inArray(invoices.serviceId, activeIds),
            eq(invoices.status, "unpaid"),
          ),
        )
        .all()
    : [];

  const activeCount = myServices.filter((service) => service.status === "active").length;
  const provisioningCount = myServices.filter(
    (service) => service.status === "provisioning",
  ).length;
  const newInvoice = upcoming[0] ?? unpaid[0] ?? null;
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Halo, ${firstName}`}
        description={`Selamat datang kembali di panel ${brand.siteName}. Pantau layanan, tagihan, dan aktivitas akunmu di satu tempat.`}
        actions={
          <>
            <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
              <Link href="/dashboard/saldo">
                <Wallet className="size-4" /> Top up saldo
              </Link>
            </Button>
            <Button asChild className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
              <Link href="/dashboard/pesanan/baru">
                <Plus className="size-4" /> Pesan VPS
              </Link>
            </Button>
          </>
        }
      />

      {unpaid.length > 0 ? (
        <Alert className="border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]">
          <CircleAlert className="size-4" />
          <AlertTitle>
            {unpaid.length} tagihan menunggu pembayaran ({formatIDR(unpaidTotal)})
          </AlertTitle>
          <AlertDescription className="text-[#92400E]/80">
            Selesaikan pembayaran agar layanan tidak ditangguhkan.{" "}
            <Link
              href="/dashboard/invoices"
              className="font-semibold text-[#92400E] underline underline-offset-2"
            >
              Lihat invoice
            </Link>
            {newInvoice ? (
              <>
                {" "}
                · Jatuh tempo terdekat {formatDateTime(newInvoice.dueDate)}
              </>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="VPS aktif"
          value={activeCount}
          icon={Server}
          hint={
            provisioningCount > 0
              ? `${provisioningCount} sedang disiapkan`
              : `${myServices.length} total layanan`
          }
          href="/dashboard/vps"
        />
        <StatCard
          label="Tagihan belum dibayar"
          value={formatIDR(unpaidTotal)}
          icon={Receipt}
          hint={
            unpaid.length
              ? `${unpaid.length} invoice · ${formatRelative(unpaid[0]?.dueDate)} jatuh tempo`
              : "Semua tagihan lunas"
          }
          tone={unpaid.length ? "warning" : "default"}
          href="/dashboard/invoices"
        />
        <StatCard
          label="Saldo akun"
          value={formatIDR(user.balance)}
          icon={Wallet}
          hint="Bisa dipakai untuk pesanan & perpanjangan"
          tone="mint"
          href="/dashboard/saldo"
        />
        <StatCard
          label="Tiket terbuka"
          value={openTickets.length}
          icon={LifeBuoy}
          hint={openTickets.length ? `Terakhir ${formatRelative(openTickets[0]?.updatedAt)}` : "Tidak ada tiket aktif"}
          href="/dashboard/tiket"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <SectionCard
          title="VPS saya"
          description="Layanan aktif dan yang sedang disiapkan."
          action={
            <Button asChild variant="ghost" size="sm" className="text-[#0B3D2E] hover:bg-[#F3F9F5]">
              <Link href="/dashboard/vps">
                Semua VPS <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
          bodyClassName="p-0"
        >
          {myServices.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Server}
                title="Belum ada VPS"
                description="Pesan VPS pertamamu dan server akan aktif otomatis setelah pembayaran terkonfirmasi."
                action={
                  <Button asChild className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
                    <Link href="/dashboard/pesanan/baru">
                      <Plus className="size-4" /> Pesan VPS sekarang
                    </Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-[#EDF1EE]">
              {myServices.slice(0, 4).map((service) => {
                const plan = planMap.get(service.planId);
                const region = regionMap.get(service.regionSlug);
                return (
                  <li key={service.id}>
                    <Link
                      href={`/dashboard/vps/${service.id}`}
                      className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-[#FBFCFB] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
                          <Server className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#101613]">{service.hostname}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5B6B60]">
                            <span>{plan?.name ?? "Paket"}</span>
                            <span className="inline-flex items-center gap-1">
                              <Globe2 className="size-3" /> {region?.name ?? service.regionSlug}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Cpu className="size-3" /> {plan?.vcpus ?? "—"} vCPU
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <HardDrive className="size-3" /> {plan?.diskGb ?? "—"} GB
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:justify-end">
                        <div className="text-right">
                          <StatusBadge
                            status={service.status}
                            label={serviceStatusLabel[service.status]}
                          />
                          <p className="mt-1 text-[11px] text-[#8A9A90]">
                            {service.ipv4 ?? "IP menyusul"} · s/d{" "}
                            {service.periodEnd ? formatDateTime(service.periodEnd) : "—"}
                          </p>
                        </div>
                        <ArrowRight className="size-4 shrink-0 text-[#8A9A90]" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Aktivitas terakhir"
            description="Pesanan terbaru di akunmu."
            bodyClassName="p-0"
          >
            {recentOrders.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#5B6B60]">
                Belum ada pesanan.
              </p>
            ) : (
              <ul className="divide-y divide-[#EDF1EE]">
                {recentOrders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/dashboard/pesanan/${order.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-[#FBFCFB]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#101613]">
                          {order.priceSnapshot.planName}
                        </p>
                        <p className="mt-0.5 text-xs text-[#8A9A90]">
                          {order.orderNumber} · {cycleLabel[order.billingCycle]}
                        </p>
                      </div>
                      <div className="text-right">
                        <StatusBadge
                          status={order.status}
                          label={orderStatusLabel[order.status]}
                        />
                        <p className="mt-1 text-[11px] text-[#8A9A90]">{formatRelative(order.createdAt)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Pintasan" bodyClassName="p-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/dashboard/pesanan/baru", label: "Pesan VPS", icon: ShoppingCart },
                { href: "/dashboard/invoices", label: "Bayar tagihan", icon: CreditCard },
                { href: "/dashboard/tiket/baru", label: "Buka tiket", icon: LifeBuoy },
                { href: "/dashboard/ssh-keys", label: "SSH keys", icon: Clock },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col gap-2 rounded-xl border border-[#E3E8E4] p-3.5 text-sm font-semibold text-[#101613] transition-colors hover:border-[#BFE3CC] hover:bg-[#F3F9F5]"
                >
                  <item.icon className="size-4 text-[#0B3D2E]" />
                  {item.label}
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      {openTickets.length > 0 ? (
        <SectionCard
          title="Tiket aktif"
          description="Balasan tim support akan tampil di sini."
          action={
            <Button asChild variant="ghost" size="sm" className="text-[#0B3D2E] hover:bg-[#F3F9F5]">
              <Link href="/dashboard/tiket">Semua tiket</Link>
            </Button>
          }
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-[#EDF1EE]">
            {openTickets.slice(0, 3).map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/dashboard/tiket/${ticket.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#FBFCFB]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#101613]">{ticket.subject}</p>
                    <p className="text-xs text-[#8A9A90]">
                      {ticket.ticketNumber} · diperbarui {formatRelative(ticket.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge status={ticket.status} label={ticketStatusLabel[ticket.status]} />
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </div>
  );
}
