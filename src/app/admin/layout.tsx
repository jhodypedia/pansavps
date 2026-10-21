import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getPublicBrand } from "@/lib/settings";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Toaster } from "@/components/ui/sonner";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
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
      variant="admin"
    >
      {children}
      <Toaster position="top-right" closeButton />
    </DashboardShell>
  );
}
