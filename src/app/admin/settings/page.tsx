import Link from "next/link";
import { ExternalLink, MessageCircle } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import {
  DEFAULT_EMAIL_TEMPLATES,
  ENCRYPTED_SETTING_KEYS,
  getSettings,
} from "@/lib/settings";
import { ensureDoAccountSetup, listDoAccountsSafe } from "@/lib/do-accounts";
import { PageHeader } from "@/components/shared/page-header";
import { AdminSettingsTabs } from "@/components/dashboard/settings-forms";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Pengaturan" };

const tabs = ["general", "announcement", "digitalocean", "pricing", "payment", "email", "notification"];

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw.split(",").map((value) => value.trim()).filter(Boolean);
  }
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const { tab } = await searchParams;
  ensureDoAccountSetup();
  const settings = getSettings();
  const doAccounts = listDoAccountsSafe();
  const initialTab = tabs.includes(tab ?? "") ? tab! : "general";

  const secrets = Object.fromEntries(
    [...ENCRYPTED_SETTING_KEYS].map((key) => [key, Boolean(settings[key])]),
  ) as Record<string, boolean>;

  const clientSettings = { ...settings };
  for (const key of ENCRYPTED_SETTING_KEYS) clientSettings[key] = "";

  const templateKeys = (settings.email_templates || Object.keys(DEFAULT_EMAIL_TEMPLATES).join(","))
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key && DEFAULT_EMAIL_TEMPLATES[key]);
  const emailTemplates = templateKeys.map((key) => {
    const fallback = DEFAULT_EMAIL_TEMPLATES[key];
    const customSubject = settings[`email_subject_${key}`];
    const customBody = settings[`email_template_${key}`];
    return {
      key,
      title: fallback.title,
      subject: customSubject || fallback.subject,
      body: customBody || fallback.body,
      isCustom: Boolean(customSubject || customBody),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan toko"
        description="Semua nilai disimpan di database. Perubahan langsung dipakai halaman publik dan transaksi."
        actions={
          <>
            <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
              <Link href="/" target="_blank">
                <ExternalLink className="size-4" /> Lihat toko
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-[#D8E2DB] bg-white">
              <Link href="/admin/whatsapp">
                <MessageCircle className="size-4" /> WhatsApp
              </Link>
            </Button>
          </>
        }
      />

      <AdminSettingsTabs
        settings={clientSettings}
        initialTab={initialTab}
        emailTemplates={emailTemplates}
        adminEventValues={parseList(settings.wa_admin_events)}
        userEventValues={parseList(settings.wa_user_events)}
        secrets={secrets}
        appUrl={(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}
        doAccounts={doAccounts}
      />
    </div>
  );
}
