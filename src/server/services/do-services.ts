import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { services } from "@/lib/db/schema";
import { listDroplets } from "@/lib/digitalocean";
import { isMockMode } from "@/lib/settings";
import type { DoServiceDroplet, DoServiceSyncResult } from "@/lib/do-sync";

/**
 * Ambil droplet langsung dari DigitalOcean lalu cocokkan dengan layanan di DB.
 *
 * Pencocokan dilakukan lewat:
 * 1. doDropletId yang sudah tersimpan,
 * 2. tag `service-<id>` yang dibuat saat provisioning,
 * 3. hostname droplet sebagai cadangan.
 *
 * Droplet yang tidak cocok tidak diimpor otomatis karena tidak punya data
 * pemilik/paket/periode yang valid. Droplet tersebut ditampilkan sebagai
 * "belum terhubung" agar admin bisa memeriksanya.
 */
export async function syncDigitalOceanServices(): Promise<DoServiceSyncResult> {
  const droplets = await listDroplets();
  const rows = db.select().from(services).all();

  const byDropletId = new Map(
    rows.filter((service) => service.doDropletId).map((service) => [service.doDropletId!, service]),
  );
  const byTag = new Map(rows.map((service) => [`service-${service.id}`, service]));
  const byHostname = new Map(rows.map((service) => [service.hostname, service]));
  const fetchedDropletIds = new Set(droplets.map((droplet) => String(droplet.id)));

  let linked = 0;
  let updated = 0;
  const resultRows: DoServiceDroplet[] = [];

  for (const droplet of droplets) {
    const dropletId = String(droplet.id);
    const serviceTag = droplet.tags.find((tag) => tag.startsWith("service-"));
    let service =
      byDropletId.get(dropletId) ??
      (serviceTag ? byTag.get(serviceTag) : undefined) ??
      byHostname.get(droplet.name);

    // Jangan pindahkan droplet ke layanan yang sudah terhubung ke droplet lain.
    if (service?.doDropletId && service.doDropletId !== dropletId) service = undefined;

    if (service) {
      const changed =
        service.doDropletId !== dropletId ||
        service.ipv4 !== droplet.ipv4 ||
        service.ipv6 !== droplet.ipv6 ||
        service.sizeSlug !== droplet.size_slug ||
        service.regionSlug !== droplet.region.slug;

      if (changed) {
        db.update(services)
          .set({
            doDropletId: dropletId,
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

  const missing = rows.filter(
    (service) =>
      service.doDropletId &&
      service.status !== "terminated" &&
      !fetchedDropletIds.has(service.doDropletId),
  ).length;

  resultRows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    mock: isMockMode(),
    fetched: droplets.length,
    linked,
    updated,
    untracked: droplets.length - linked,
    missing,
    droplets: resultRows,
  };
}
