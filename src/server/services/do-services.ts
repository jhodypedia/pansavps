import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { services } from "@/lib/db/schema";
import { listDroplets, type DoDroplet } from "@/lib/digitalocean";
import { getActiveDoAccounts } from "@/lib/do-accounts";
import { isMockMode } from "@/lib/settings";
import type { DoServiceDroplet, DoServiceSyncResult } from "@/lib/do-sync";

/**
 * Ambil droplet dari seluruh akun DigitalOcean aktif lalu cocokkan dengan
 * layanan di DB. Pencocokan memakai ID droplet, tag `service-<id>`, lalu
 * hostname. Droplet di luar toko tidak diimpor otomatis.
 */
export async function syncDigitalOceanServices(): Promise<DoServiceSyncResult> {
  const accounts = isMockMode() ? [] : getActiveDoAccounts();
  const targets =
    accounts.length > 0
      ? accounts.map((account) => ({ id: account.id, name: account.name }))
      : [{ id: null as string | null, name: "Mock" }];

  const fetched: { accountId: string | null; accountName: string; droplet: DoDroplet }[] = [];
  for (const target of targets) {
    const droplets = await listDroplets(target.id);
    for (const droplet of droplets) {
      fetched.push({ accountId: target.id, accountName: target.name, droplet });
    }
  }

  const rows = db.select().from(services).all();
  const byDropletId = new Map(
    rows.filter((service) => service.doDropletId).map((service) => [service.doDropletId!, service]),
  );
  const byTag = new Map(rows.map((service) => [`service-${service.id}`, service]));
  const byHostname = new Map(rows.map((service) => [service.hostname, service]));
  const fetchedById = new Map<string, Set<string | null>>();
  for (const row of fetched) {
    const id = String(row.droplet.id);
    const set = fetchedById.get(id) ?? new Set<string | null>();
    set.add(row.accountId);
    fetchedById.set(id, set);
  }

  let linked = 0;
  let updated = 0;
  const resultRows: DoServiceDroplet[] = [];

  for (const item of fetched) {
    const droplet = item.droplet;
    const dropletId = String(droplet.id);
    const serviceTag = droplet.tags.find((tag) => tag.startsWith("service-"));
    let service =
      byDropletId.get(dropletId) ??
      (serviceTag ? byTag.get(serviceTag) : undefined) ??
      byHostname.get(droplet.name);

    // Jangan pindahkan droplet ke layanan yang sudah terhubung ke droplet lain
    // atau ke akun DigitalOcean yang berbeda.
    if (service?.doDropletId && service.doDropletId !== dropletId) service = undefined;
    if (service?.doAccountId && service.doAccountId !== item.accountId) service = undefined;

    if (service) {
      const changed =
        service.doDropletId !== dropletId ||
        service.doAccountId !== item.accountId ||
        service.ipv4 !== droplet.ipv4 ||
        service.ipv6 !== droplet.ipv6 ||
        service.sizeSlug !== droplet.size_slug ||
        service.regionSlug !== droplet.region.slug;

      if (changed) {
        db.update(services)
          .set({
            doDropletId: dropletId,
            doAccountId: item.accountId,
            ipv4: droplet.ipv4,
            ipv6: droplet.ipv6,
            sizeSlug: droplet.size_slug,
            regionSlug: droplet.region.slug,
          })
          .where(eq(services.id, service.id))
          .run();
        updated++;
      }
      linked++;
      resultRows.push({
        id: dropletId,
        accountId: item.accountId,
        accountName: item.accountName,
        name: droplet.name,
        status: droplet.status,
        region: droplet.region.slug,
        size: droplet.size_slug,
        ipv4: droplet.ipv4,
        createdAt: droplet.created_at,
        tags: droplet.tags,
        linkedServiceId: service.id,
        linkedHostname: service.hostname,
      });
    } else {
      resultRows.push({
        id: dropletId,
        accountId: item.accountId,
        accountName: item.accountName,
        name: droplet.name,
        status: droplet.status,
        region: droplet.region.slug,
        size: droplet.size_slug,
        ipv4: droplet.ipv4,
        createdAt: droplet.created_at,
        tags: droplet.tags,
        linkedServiceId: null,
        linkedHostname: null,
      });
    }
  }

  const missing = rows.filter((service) => {
    if (!service.doDropletId || service.status === "terminated") return false;
    const accountsForId = fetchedById.get(service.doDropletId);
    if (!accountsForId) return true;
    if (!service.doAccountId) return false;
    return !accountsForId.has(service.doAccountId);
  }).length;

  resultRows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    mock: isMockMode(),
    fetched: fetched.length,
    linked,
    updated,
    untracked: fetched.length - linked,
    missing,
    droplets: resultRows,
  };
}
