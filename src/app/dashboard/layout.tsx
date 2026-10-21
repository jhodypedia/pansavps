import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { isUserVerified, requireUser } from "@/lib/auth";
import { getPublicBrand } from "@/lib/settings";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AccountVerifyBanner } from "@/components/dashboard/account-verify-banner";
import { Toaster } from "@/components/ui/sonner";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const brand = getPublicBrand();
  const unread = db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)))
    .all().length;

  return (
    <DashboardShell
      user={{ name: user.name, email: user.email, role: user.role }}
      brandName={brand.siteName}
      logoUrl={brand.logoUrl}
      unread={unread}
      variant="user"
    >
      {!isUserVerified(user) ? <AccountVerifyBanner /> : null}
      {children}
      <Toaster position="top-right" closeButton />
    </DashboardShell>
  );
}
