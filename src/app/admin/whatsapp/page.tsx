import { desc, eq } from "drizzle-orm";
import { AlertTriangle, Inbox, MessageCircle, Send, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { waOutbox, waState, waTemplates } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatRelative } from "@/lib/format";
import { waStats } from "@/lib/whatsapp/queue";
import { DEFAULT_WA_TEMPLATES, WA_TEMPLATE_KEYS } from "@/lib/whatsapp/templates";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SectionCard } from "@/components/dashboard/section-card";
import { PollRefresh } from "@/components/dashboard/poll-refresh";
import {
  RetryFailedWa,
  WhatsAppConnect,
  WhatsAppTestForm,
  WaTemplateEditor,
} from "@/components/dashboard/whatsapp-panel";

export const metadata = { title: "WhatsApp" };

export default async function AdminWhatsAppPage() {
  await requireAdmin();
  const state = db.select().from(waState).where(eq(waState.id, "singleton")).get();
  const stats = waStats();
  const outbox = db.select().from(waOutbox).orderBy(desc(waOutbox.createdAt)).limit(25).all();
  const rows = db.select().from(waTemplates).all();
  const rowMap = new Map(rows.map((row) => [row.key, row]));
  const templates = WA_TEMPLATE_KEYS.map((key) => {
    const row = rowMap.get(key);
    return {
      key,
      title: row?.title ?? DEFAULT_WA_TEMPLATES[key].title,
      body: row?.body ?? DEFAULT_WA_TEMPLATES[key].body,
      isActive: row?.isActive ?? true,
      isCustom: Boolean(row),
    };
  });
  const failedIds = db
    .select()
    .from(waOutbox)
    .where(eq(waOutbox.status, "failed"))
    .all()
    .map((row) => row.id);

  const status = state?.status ?? "disconnected";
  const waiting = ["qr_pending", "pairing_pending", "connecting"].includes(status);

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp"
        description="Hubungkan akun WhatsApp toko untuk notifikasi transaksi ke pelanggan dan admin."
      />
      <PollRefresh enabled={waiting} intervalMs={4000} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Status koneksi", value: status.replace("_", " "), hint: state?.phone ? `+${state.phone}` : "Belum ada nomor", icon: MessageCircle },
          { label: "Terkirim hari ini", value: String(stats.sentToday), hint: `${stats.queued} antre`, icon: Send },
          { label: "Gagal", value: String(stats.failed), hint: "Dapat dicoba ulang", icon: AlertTriangle },
          { label: "Sedang dikirim", value: String(stats.sending), hint: "Diproses worker", icon: Inbox },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[#E3E8E4] bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">{item.label}</p>
              <span className="flex size-8 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
                <item.icon className="size-4" />
              </span>
            </div>
            <p className="mt-2 font-display text-xl font-bold text-[#101613] capitalize">{item.value}</p>
            <p className="mt-0.5 text-xs text-[#8A9A90]">{item.hint}</p>
          </div>
        ))}
      </div>

      <SectionCard
        title="Koneksi perangkat"
        description="Sesi WhatsApp disimpan di worker; kredensial tidak pernah dikirim ke browser."
        action={failedIds.length > 0 ? <RetryFailedWa ids={failedIds} /> : null}
      >
        <WhatsAppConnect
          status={status}
          phone={state?.phone ?? null}
          profileName={state?.profileName ?? null}
          connectedAt={state?.connectedAt ? formatDateTime(state.connectedAt) : null}
          lastQr={state?.lastQr ?? null}
          pairingCode={state?.pairingCode ?? null}
          lastError={state?.lastError ?? null}
        />
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <SectionCard title="Kirim pesan uji" description="Memastikan worker dan koneksi berfungsi.">
          <WhatsAppTestForm />
          <div className="mt-4 rounded-xl border border-[#E3E8E4] bg-[#F7F8F7] p-3 text-xs leading-relaxed text-[#5B6B60]">
            <p className="flex items-center gap-1.5 font-semibold text-[#0B3D2E]">
              <ShieldCheck className="size-3.5" /> Tips operasional
            </p>
            <p className="mt-1">
              Jalankan worker dengan <code className="rounded bg-white px-1 py-0.5">npm run wa:worker</code>.
              Jika worker mati, pesan tetap tersimpan di antrean dan dikirim saat worker aktif kembali.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Antrean terbaru" description="25 pesan terakhir." bodyClassName="p-0">
          {outbox.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={Inbox} title="Antrean kosong" description="Notifikasi WhatsApp akan muncul di sini." />
            </div>
          ) : (
            <ul className="max-h-[420px] divide-y divide-[#EDF1EE] overflow-y-auto">
              {outbox.map((row) => (
                <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#101613]">{row.toNumber}</p>
                    <p className="font-mono text-[10px] text-[#8A9A90]">{row.templateKey}</p>
                    {row.lastError ? <p className="mt-0.5 text-xs text-[#991B1B]">{row.lastError}</p> : null}
                  </div>
                  <div className="text-right">
                    <StatusBadge
                      status={row.status === "sent" ? "success" : row.status === "failed" ? "failed" : "queued"}
                      label={row.status}
                    />
                    <p className="mt-1 text-[10px] text-[#8A9A90]">{formatRelative(row.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Template WhatsApp"
        description="Placeholder diganti otomatis. Password provisioning dikirim sekali dan disimpan terenkripsi."
        bodyClassName="p-0"
      >
        <div className="divide-y divide-[#EDF1EE]">
          {templates.map((template) => (
            <WaTemplateEditor
              key={template.key}
              templateKey={template.key}
              title={template.title}
              body={template.body}
              isActive={template.isActive}
              isCustom={template.isCustom}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
