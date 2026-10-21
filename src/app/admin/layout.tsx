import { and, desc, eq } from "drizzle-orm";
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
  const recent = db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      link: notifications.link,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(6)
    .all()
    .map(({ createdAt, ...item }) => ({
      ...item,
      createdAt: createdAt.toISOString(),
    }));

  return (
    <DashboardShell
      user={{ name: user.name, email: user.email, role: user.role }}
      brandName={brand.siteName}
      logoUrl={brand.logoUrl}
      unread={unread}
      notifications={recent}
      variant="admin"
    >
      {children}
      <Toaster position="top-right" closeButton />
    </DashboardShell>
  );
}
