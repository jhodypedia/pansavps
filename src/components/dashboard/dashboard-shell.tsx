"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  Bell,
  ChevronDown,
  Command,
  CreditCard,
  ExternalLink,
  FileText,
  Gauge,
  Home,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Package,
  Receipt,
  Server,
  Settings,
  ShoppingCart,
  Tag,
  Ticket,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandMenu, type SearchItem } from "@/components/dashboard/command-menu";
import {
  NotificationBell,
  type NotificationPreview,
} from "@/components/dashboard/notification-bell";

type NavItem = { label: string; href: string; icon: typeof Home; exact?: boolean };

const userNav: { group: string; items: NavItem[] }[] = [
  {
    group: "Utama",
    items: [
      { label: "Ringkasan", href: "/dashboard", icon: LayoutDashboard, exact: true },
      { label: "VPS Saya", href: "/dashboard/vps", icon: Server },
      { label: "Pesanan", href: "/dashboard/pesanan", icon: ShoppingCart },
      { label: "Invoice", href: "/dashboard/invoices", icon: Receipt },
    ],
  },
  {
    group: "Keuangan & bantuan",
    items: [
      { label: "Saldo", href: "/dashboard/saldo", icon: Wallet },
      { label: "Tiket", href: "/dashboard/tiket", icon: LifeBuoy },
      { label: "SSH Keys", href: "/dashboard/ssh-keys", icon: KeyRound },
      { label: "Notifikasi", href: "/dashboard/notifikasi", icon: Bell },
    ],
  },
  {
    group: "Akun",
    items: [{ label: "Pengaturan", href: "/dashboard/pengaturan", icon: Settings }],
  },
];

const adminNav: { group: string; items: NavItem[] }[] = [
  {
    group: "Operasional",
    items: [
      { label: "Ringkasan", href: "/admin", icon: Gauge, exact: true },
      { label: "Pesanan", href: "/admin/orders", icon: ShoppingCart },
      { label: "Layanan VPS", href: "/admin/services", icon: Server },
      { label: "Invoice", href: "/admin/invoices", icon: Receipt },
      { label: "Pembayaran", href: "/admin/payments", icon: CreditCard },
    ],
  },
  {
    group: "Katalog & pengguna",
    items: [
      { label: "Paket", href: "/admin/plans", icon: Package },
      { label: "Promo", href: "/admin/promo", icon: Tag },
      { label: "Pengguna", href: "/admin/users", icon: Users },
      { label: "Tiket", href: "/admin/tickets", icon: Ticket },
    ],
  },
  {
    group: "Sistem",
    items: [
      { label: "WhatsApp", href: "/admin/whatsapp", icon: Activity },
      { label: "Log", href: "/admin/logs", icon: FileText },
      { label: "Pengaturan", href: "/admin/settings", icon: Settings },
    ],
  },
];

const userSearch: SearchItem[] = [
  { label: "Ringkasan dashboard", href: "/dashboard", group: "Dashboard" },
  { label: "VPS saya", href: "/dashboard/vps", group: "Dashboard" },
  { label: "Pesan VPS baru", href: "/dashboard/pesanan/baru", group: "Dashboard" },
  { label: "Pesanan", href: "/dashboard/pesanan", group: "Dashboard" },
  { label: "Invoice", href: "/dashboard/invoices", group: "Keuangan" },
  { label: "Top up saldo", href: "/dashboard/saldo", group: "Keuangan" },
  { label: "Buka tiket", href: "/dashboard/tiket/baru", group: "Bantuan" },
  { label: "SSH keys", href: "/dashboard/ssh-keys", group: "Akun" },
  { label: "Notifikasi", href: "/dashboard/notifikasi", group: "Akun" },
  { label: "Pengaturan akun", href: "/dashboard/pengaturan", group: "Akun" },
  { label: "Lihat toko", href: "/", group: "Navigasi" },
];

const adminSearch: SearchItem[] = [
  { label: "Ringkasan admin", href: "/admin", group: "Admin" },
  { label: "Pesanan", href: "/admin/orders", group: "Admin" },
  { label: "Layanan VPS", href: "/admin/services", group: "Admin" },
  { label: "Invoice", href: "/admin/invoices", group: "Admin" },
  { label: "Verifikasi pembayaran", href: "/admin/payments", group: "Admin" },
  { label: "Paket", href: "/admin/plans", group: "Katalog" },
  { label: "Promo", href: "/admin/promo", group: "Katalog" },
  { label: "Pengguna", href: "/admin/users", group: "Pengguna" },
  { label: "Tiket", href: "/admin/tickets", group: "Pengguna" },
  { label: "WhatsApp", href: "/admin/whatsapp", group: "Sistem" },
  { label: "Log & audit", href: "/admin/logs", group: "Sistem" },
  { label: "Pengaturan", href: "/admin/settings", group: "Sistem" },
  { label: "Buka dashboard user", href: "/dashboard", group: "Navigasi" },
  { label: "Lihat toko", href: "/", group: "Navigasi" },
];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DashboardShell({
  user,
  brandName,
  logoUrl,
  unread,
  notifications,
  variant,
  children,
}: {
  user: { name: string; email: string; role: string };
  brandName: string;
  logoUrl?: string | null;
  unread: number;
  notifications: NotificationPreview[];
  variant: "user" | "admin";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = variant === "admin" ? adminNav : userNav;
  const searchItems = variant === "admin" ? adminSearch : userSearch;

  const sidebar = (
    <div className="flex h-full flex-col bg-[#0B3D2E] text-white">
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
        <Logo name={brandName} logoUrl={logoUrl} inverted href={variant === "admin" ? "/admin" : "/dashboard"} />
        <button
          type="button"
          className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Tutup menu"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-white/10">
            {variant === "admin" ? <ShieldIcon /> : <Server className="size-3.5" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">
              {variant === "admin" ? "Panel Admin" : "Panel Pelanggan"}
            </p>
            <p className="truncate text-[10px] text-white/50">
              {variant === "admin" ? "Operasional toko" : "Kelola layananmu"}
            </p>
          </div>
        </div>

        <nav className="flex flex-col gap-5" aria-label="Navigasi dashboard">
          {nav.map((group) => (
            <div key={group.group}>
              <p className="px-3 pb-2 text-[10px] font-bold tracking-wider text-white/40 uppercase">
                {group.group}
              </p>
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const active = isActive(pathname, item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-white text-[#0B3D2E]"
                            : "text-white/70 hover:bg-white/10 hover:text-white",
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <item.icon className={cn("size-4", active ? "text-[#0B3D2E]" : "text-white/50")} />
                        <span className="flex-1">{item.label}</span>
                        {item.href === "/dashboard/notifikasi" && unread > 0 ? (
                          <span className="rounded-full bg-[#16A34A] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/10 p-3">
        {variant === "admin" ? (
          <Link
            href="/dashboard"
            className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white"
          >
            <LayoutDashboard className="size-3.5" /> Dashboard user
          </Link>
        ) : (
          <Link
            href="/"
            className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white"
          >
            <ExternalLink className="size-3.5" /> Lihat toko
          </Link>
        )}
        <div className="flex items-center gap-2.5 rounded-xl bg-white/5 p-2.5">
          <Avatar className="size-8 border border-white/20">
            <AvatarFallback className="bg-[#0E4D38] text-[11px] font-bold text-white">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{user.name}</p>
            <p className="truncate text-[10px] text-white/50">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void logoutAction()}
            className="rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Keluar"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F8F7]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] lg:block">{sidebar}</aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] border-0 bg-[#0B3D2E] p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 border-b border-[#E3E8E4] bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Button
              variant="outline"
              size="icon"
              className="border-[#D8E2DB] lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka menu"
            >
              <Menu className="size-5" />
            </Button>

            <div className="hidden sm:block">
              <CommandMenu items={searchItems} />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <NotificationBell
                items={notifications}
                unread={unread}
                allHref="/dashboard/notifikasi"
              />

              {variant === "admin" ? (
                <Button asChild variant="outline" size="sm" className="hidden border-[#D8E2DB] sm:inline-flex">
                  <Link href="/" target="_blank">
                    <ExternalLink className="size-3.5" /> Toko
                  </Link>
                </Button>
              ) : null}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg border border-[#E3E8E4] bg-white px-2 py-1.5 text-left hover:bg-[#FBFCFB]"
                  >
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-[#0B3D2E] text-[10px] font-bold text-white">
                        {initials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-[120px] truncate text-xs font-semibold text-[#101613] sm:block">
                      {user.name}
                    </span>
                    <ChevronDown className="size-3.5 text-[#8A9A90]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 border-[#E3E8E4] bg-white">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-sm font-semibold text-[#101613]">{user.name}</p>
                    <p className="truncate text-xs text-[#5B6B60]">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-[#E3E8E4]" />
                  <DropdownMenuItem asChild>
                    <Link href={variant === "admin" ? "/dashboard/pengaturan" : "/dashboard/pengaturan"}>
                      <Settings className="size-4" /> Pengaturan akun
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/notifikasi">
                      <Bell className="size-4" /> Notifikasi
                      {unread > 0 ? (
                        <span className="ml-auto rounded-full bg-[#E7F4EC] px-1.5 text-[10px] font-bold text-[#0B3D2E]">
                          {unread}
                        </span>
                      ) : null}
                    </Link>
                  </DropdownMenuItem>
                  {variant === "admin" ? (
                    <DropdownMenuItem asChild>
                      <Link href="/admin/settings">
                        <Settings className="size-4" /> Pengaturan toko
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator className="bg-[#E3E8E4]" />
                  <DropdownMenuItem
                    className="text-[#B91C1C] focus:bg-[#FEE2E2] focus:text-[#991B1B]"
                    onClick={() => void logoutAction()}
                  >
                    <LogOut className="size-4" /> Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return <Command className="size-3.5" />;
}
