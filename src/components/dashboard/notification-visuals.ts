import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarClock,
  CreditCard,
  KeyRound,
  LifeBuoy,
  PauseCircle,
  PowerOff,
  Receipt,
  RefreshCw,
  Server,
  ServerCrash,
  ShieldCheck,
  ShoppingCart,
  UserPlus,
  Wallet,
} from "lucide-react";

export type NotificationTone = "green" | "red" | "amber" | "blue" | "gray";

export const notificationToneClass: Record<NotificationTone, string> = {
  green: "bg-[#E7F4EC] text-[#0B3D2E]",
  red: "bg-[#FEF2F2] text-[#B91C1C]",
  amber: "bg-[#FFFBEB] text-[#B45309]",
  blue: "bg-[#EFF6FF] text-[#1D4ED8]",
  gray: "bg-[#F1F3F2] text-[#5B6B60]",
};

export function notificationTypeLabel(type: string): string {
  if (type.includes("failed")) return "Kegagalan";
  if (type.includes("weekly") && type.includes("expiry")) return "VPS mingguan";
  if (type.includes("terminated")) return "Layanan berhenti";
  if (type.includes("suspended")) return "Penangguhan";
  if (type.includes("renewed")) return "Perpanjangan";
  if (type.includes("paid") || type.includes("topup")) return "Pembayaran";
  if (type.includes("provisioning")) return "Pembuatan server";
  if (type.includes("invoice")) return "Invoice";
  if (type.includes("ticket")) return "Tiket";
  if (type.includes("order")) return "Pesanan";
  if (type.includes("welcome") || type.includes("verification")) return "Akun";
  if (type.includes("password")) return "Keamanan";
  if (type.includes("refund") || type.includes("balance")) return "Saldo";
  if (type.includes("service")) return "Layanan";
  return "Informasi";
}

export function notificationVisual(type: string): {
  icon: LucideIcon;
  tone: NotificationTone;
} {
  if (type.includes("failed")) return { icon: ServerCrash, tone: "red" };
  if (type.includes("weekly") && type.includes("expiry")) {
    return { icon: CalendarClock, tone: "amber" };
  }
  if (type.includes("terminated")) return { icon: PowerOff, tone: "red" };
  if (type.includes("suspended")) return { icon: PauseCircle, tone: "amber" };
  if (type.includes("renewed")) return { icon: RefreshCw, tone: "green" };
  if (type.includes("paid") || type.includes("topup")) {
    return { icon: CreditCard, tone: "green" };
  }
  if (type.includes("provisioning")) return { icon: Server, tone: "green" };
  if (type.includes("invoice")) return { icon: Receipt, tone: "amber" };
  if (type.includes("ticket")) return { icon: LifeBuoy, tone: "blue" };
  if (type.includes("order")) return { icon: ShoppingCart, tone: "blue" };
  if (type.includes("welcome") || type.includes("verification")) {
    return { icon: type.includes("welcome") ? UserPlus : ShieldCheck, tone: "green" };
  }
  if (type.includes("password")) return { icon: KeyRound, tone: "gray" };
  if (type.includes("service")) return { icon: Server, tone: "blue" };
  if (type.includes("balance") || type.includes("refund")) {
    return { icon: Wallet, tone: "green" };
  }
  return { icon: Bell, tone: "gray" };
}
