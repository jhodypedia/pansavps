import Link from "next/link";
import { desc } from "drizzle-orm";
import { Activity, AlertTriangle, FileText, Inbox, Mail, PlayCircle } from "lucide-react";
import { db } from "@/lib/db";
import { auditLogs, cronLogs, emailLog, waOutbox } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SectionCard } from "@/components/dashboard/section-card";
import { ActionButton } from "@/components/dashboard/action-button";
import { runCronAction } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Log & Audit" };

const tabs = [
  { key: "audit", label: "Audit trail", icon: FileText },
  { key: "cron", label: "Cron", icon: Activity },
  { key: "email", label: "Email", icon: Mail },
  { key: "wa", label: "WhatsApp", icon: Inbox },
];

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  await requireAdmin();
  const { tab, q } = await searchParams;
  const activeTab = tabs.some((item) => item.key === tab) ? tab! : "audit";
  const search = (q ?? "").trim().toLowerCase();

  const audits = db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(300).all();
  const crons = db.select().from(cronLogs).orderBy(desc(cronLogs.createdAt)).limit(60).all();
  const emails = db.select().from(emailLog).orderBy(desc(emailLog.createdAt)).limit(300).all();
  const waRows = db.select().from(waOutbox).orderBy(desc(waOutbox.createdAt)).limit(300).all();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredAudits = audits.filter((log) =>
    !search
      ? true
      : [log.action, log.entity, log.entityId, log.actorEmail, log.ip]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search)),
  );
  const filteredEmails = emails.filter((log) =>
    !search
      ? true
      : [log.toEmail, log.subject, log.templateKey, log.status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search)),
  );
  const filteredWa = waRows.filter((row) =>
    !search
      ? true
      : [row.toNumber, row.templateKey, row.status, row.lastError]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search)),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Log & audit"
        description="Jejak aktivitas admin, pengiriman email/WhatsApp, dan eksekusi cron."
        actions={
          <ActionButton
            action={runCronAction}
            className="border-[#BFE3CC] bg-white text-[#0B3D2E]"
            pendingText="Menjalankan…"
          >
            <PlayCircle className="size-4" /> Jalankan cron
          </ActionButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Audit hari ini", value: String(audits.filter((log) => log.createdAt >= today).length), hint: `${audits.length} entri terbaru dimuat` },
          { label: "Cron terakhir", value: crons[0]?.status ?? "—", hint: crons[0] ? formatDateTime(crons[0].createdAt) : "Belum pernah jalan" },
          { label: "Email gagal", value: String(emails.filter((log) => log.status === "failed").length), hint: `${emails.length} email terbaru` },
          { label: "WA gagal / antre", value: `${waRows.filter((row) => row.status === "failed").length} / ${waRows.filter((row) => row.status === "queued").length}`, hint: "Butuh perhatian jika gagal" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[#E3E8E4] bg-white p-5">
            <p className="text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">{item.label}</p>
            <p className="mt-2 font-display text-xl font-bold text-[#101613] capitalize">{item.value}</p>
            <p className="mt-0.5 text-xs text-[#8A9A90]">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <Button
              key={item.key}
              asChild
              variant={activeTab === item.key ? "default" : "outline"}
              size="sm"
              className={cn(
                activeTab === item.key
                  ? "bg-[#0B3D2E] text-white hover:bg-[#0E4D38]"
                  : "border-[#D8E2DB] bg-white text-[#5B6B60]",
              )}
            >
              <Link href={`/admin/logs?tab=${item.key}`}>
                <item.icon className="size-3.5" /> {item.label}
              </Link>
            </Button>
          ))}
        </div>
        {["audit", "email", "wa"].includes(activeTab) ? (
          <form className="flex gap-2" action="/admin/logs">
            <input type="hidden" name="tab" value={activeTab} />
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Cari log…"
              className="h-9 w-full rounded-md border border-[#D8E2DB] bg-white px-3 text-sm sm:w-64"
            />
            <Button type="submit" variant="outline" className="border-[#D8E2DB] bg-white">
              Cari
            </Button>
          </form>
        ) : null}
      </div>

      {activeTab === "audit" ? (
        <SectionCard title="Audit trail" description="Aktivitas terbaru, termasuk login dan perubahan data." bodyClassName="p-0">
          {filteredAudits.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={FileText} title="Belum ada log" description="Aktivitas admin dan pengguna akan tercatat di sini." />
            </div>
          ) : (
            <ul className="divide-y divide-[#EDF1EE]">
              {filteredAudits.map((log) => (
                <li key={log.id} className="px-5 py-3">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#101613]">{log.action}</p>
                        <p className="text-xs text-[#8A9A90]">
                          {log.entity}
                          {log.entityId ? ` · ${log.entityId}` : ""} · {log.actorEmail ?? "system"} · {log.ip ?? "—"}
                        </p>
                      </div>
                      <span className="text-xs whitespace-nowrap text-[#8A9A90]">{formatDateTime(log.createdAt)}</span>
                    </summary>
                    {log.before || log.after ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {log.before ? (
                          <pre className="overflow-x-auto rounded-lg bg-[#F7F8F7] p-3 text-[10px] leading-relaxed text-[#5B6B60]">
                            {JSON.stringify(log.before, null, 2)}
                          </pre>
                        ) : null}
                        {log.after ? (
                          <pre className="overflow-x-auto rounded-lg bg-[#F7F8F7] p-3 text-[10px] leading-relaxed text-[#5B6B60]">
                            {JSON.stringify(log.after, null, 2)}
                          </pre>
                        ) : null}
                      </div>
                    ) : null}
                  </details>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}

      {activeTab === "cron" ? (
        <SectionCard title="Riwayat cron" description="Pengingat, penangguhan, dan pembersihan otomatis." bodyClassName="p-0">
          {crons.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={Activity} title="Cron belum berjalan" description="Jalankan cron manual atau tunggu scheduler." />
            </div>
          ) : (
            <ul className="divide-y divide-[#EDF1EE]">
              {crons.map((log) => (
                <li key={log.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#101613]">{log.job}</p>
                    <p className="text-xs text-[#8A9A90]">
                      Mulai {formatDateTime(log.startedAt)} · selesai {formatDateTime(log.finishedAt)}
                    </p>
                    {log.summary ? (
                      <pre className="mt-1 max-w-full overflow-x-auto rounded-lg bg-[#F7F8F7] p-2 text-[10px] text-[#5B6B60]">
                        {JSON.stringify(log.summary, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                  <StatusBadge status={log.status === "success" ? "success" : log.status === "failed" ? "failed" : "queued"} label={log.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}

      {activeTab === "email" ? (
        <SectionCard title="Log email" description="Email yang dikirim lewat SMTP atau hanya dicatat saat mode log." bodyClassName="p-0">
          {filteredEmails.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={Mail} title="Belum ada email" description="Email transaksional akan tercatat di sini." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm">
                <thead>
                  <tr className="border-b border-[#E3E8E4] bg-[#F7F8F7] text-left text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">
                    <th className="px-4 py-2.5">Penerima</th>
                    <th className="px-4 py-2.5">Subjek</th>
                    <th className="px-4 py-2.5">Template</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmails.map((log) => (
                    <tr key={log.id} className="border-b border-[#EDF1EE] last:border-0">
                      <td className="px-4 py-3 text-[#101613]">{log.toEmail}</td>
                      <td className="px-4 py-3 text-[#5B6B60]">
                        {log.subject}
                        {log.error ? <span className="mt-0.5 block text-xs text-[#991B1B]">{log.error}</span> : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#8A9A90]">{log.templateKey ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={log.status === "sent" ? "success" : log.status === "failed" ? "failed" : "queued"} label={log.status} />
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-[#8A9A90]">{formatDateTime(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      ) : null}

      {activeTab === "wa" ? (
        <SectionCard title="Antrean WhatsApp" description="Pesan keluar beserta status pengiriman worker." bodyClassName="p-0">
          {filteredWa.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={AlertTriangle} title="Belum ada pesan" description="Notifikasi WhatsApp akan muncul di sini." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-[#E3E8E4] bg-[#F7F8F7] text-left text-xs font-semibold tracking-wide text-[#5B6B60] uppercase">
                    <th className="px-4 py-2.5">Nomor</th>
                    <th className="px-4 py-2.5">Template</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Percobaan</th>
                    <th className="px-4 py-2.5">Dibuat</th>
                    <th className="px-4 py-2.5">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWa.map((row) => (
                    <tr key={row.id} className="border-b border-[#EDF1EE] last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-[#101613]">{row.toNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#5B6B60]">{row.templateKey}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status === "sent" ? "success" : row.status === "failed" ? "failed" : "queued"} label={row.status} />
                      </td>
                      <td className="px-4 py-3 text-[#5B6B60]">{row.attempts}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-[#8A9A90]">{formatDateTime(row.createdAt)}</td>
                      <td className="max-w-[220px] px-4 py-3 text-xs text-[#991B1B]">{row.lastError ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
