import "server-only";

import { getSettings, isMockMode } from "@/lib/settings";
import { uid } from "@/lib/format";

const BASE_URL = "https://api.digitalocean.com/v2";
const TIMEOUT_MS = 15_000;

export class DigitalOceanError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 502, code = "do_error") {
    super(message);
    this.name = "DigitalOceanError";
    this.status = status;
    this.code = code;
  }
}

export const MOCK_SIZES: DoSize[] = [
  { slug: "s-1vcpu-1gb", memory: 1024, vcpus: 1, disk: 25, transfer: 1, price_monthly: 6, available: true, regions: ["sgp1", "nyc1", "fra1"] },
  { slug: "s-1vcpu-2gb", memory: 2048, vcpus: 1, disk: 50, transfer: 2, price_monthly: 12, available: true, regions: ["sgp1", "nyc1", "fra1"] },
  { slug: "s-2vcpu-4gb", memory: 4096, vcpus: 2, disk: 80, transfer: 4, price_monthly: 24, available: true, regions: ["sgp1", "nyc1", "fra1"] },
  { slug: "s-4vcpu-8gb", memory: 8192, vcpus: 4, disk: 160, transfer: 5, price_monthly: 48, available: true, regions: ["sgp1", "nyc1", "fra1"] },
  { slug: "s-8vcpu-16gb", memory: 16384, vcpus: 8, disk: 320, transfer: 6, price_monthly: 96, available: true, regions: ["sgp1", "nyc1", "fra1"] },
];

export const MOCK_REGIONS: DoRegion[] = [
  { slug: "sgp1", name: "Singapore 1", country: "Singapore", available: true, sizes: ["s-1vcpu-1gb", "s-1vcpu-2gb", "s-2vcpu-4gb", "s-4vcpu-8gb", "s-8vcpu-16gb"] },
  { slug: "nyc1", name: "New York 1", country: "United States", available: true, sizes: ["s-1vcpu-1gb", "s-1vcpu-2gb", "s-2vcpu-4gb"] },
  { slug: "fra1", name: "Frankfurt 1", country: "Germany", available: true, sizes: ["s-1vcpu-1gb", "s-1vcpu-2gb", "s-2vcpu-4gb"] },
];

export const MOCK_IMAGES: DoImage[] = [
  { slug: "ubuntu-24-04-x64", name: "Ubuntu 24.04 LTS x64", distribution: "Ubuntu", version: "24.04", type: "distribution", public: true },
  { slug: "ubuntu-22-04-x64", name: "Ubuntu 22.04 LTS x64", distribution: "Ubuntu", version: "22.04", type: "distribution", public: true },
  { slug: "debian-12-x64", name: "Debian 12 x64", distribution: "Debian", version: "12", type: "distribution", public: true },
  { slug: "almalinux-9-x64", name: "AlmaLinux 9 x64", distribution: "AlmaLinux", version: "9", type: "distribution", public: true },
  { slug: "rocky-9-x64", name: "Rocky Linux 9 x64", distribution: "Rocky", version: "9", type: "distribution", public: true },
];

/* ── Tipe API ─────────────────────────────────────────────── */
export type DoAccount = {
  email: string;
  status: string;
  droplet_limit: number;
  floating_ip_limit: number;
  email_verified: boolean;
  uuid: string;
};

export type DoSize = {
  slug: string;
  memory: number;
  vcpus: number;
  disk: number;
  transfer: number;
  price_monthly: number;
  available: boolean;
  regions: string[];
  description?: string;
};

export type DoRegion = {
  slug: string;
  name: string;
  country: string;
  available: boolean;
  sizes: string[];
};

export type DoImage = {
  slug: string;
  name: string;
  distribution: string;
  version: string;
  type: string;
  public: boolean;
};

export type DoDroplet = {
  id: number;
  name: string;
  status: string;
  memory: number;
  vcpus: number;
  disk: number;
  region: { slug: string; name: string };
  image: { slug: string; name: string } | null;
  size_slug: string;
  ipv4: string | null;
  ipv6: string | null;
  tags: string[];
  created_at: string;
  rootPassword?: string;
};

export type DropletAction =
  | "power_on"
  | "power_off"
  | "shutdown"
  | "power_cycle"
  | "reboot"
  | "password_reset"
  | "enable_ipv6"
  | "enable_backups"
  | "disable_backups";

type Json = Record<string, unknown>;

function config() {
  const s = getSettings();
  return { token: s.do_token, mock: isMockMode() };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<T> {
  const { token, mock } = config();
  if (mock) throw new Error("MOCK");
  if (!token) throw new DigitalOceanError("Token DigitalOcean belum diatur.", 400, "no_token");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if ((res.status >= 500 || res.status === 429) && attempt < 2) {
      const retryAfter = Number(res.headers.get("retry-after") ?? 0);
      const wait = Math.min(5000, Math.max(500, retryAfter * 1000 || 700 * (attempt + 1)));
      await new Promise((r) => setTimeout(r, wait));
      return request<T>(path, init, attempt + 1);
    }

    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as { message?: string; id?: string };
        detail = body.message ?? "";
      } catch {
        // response bukan JSON
      }
      const safe = detail && detail.length < 180 ? detail : "Permintaan ke DigitalOcean gagal.";
      throw new DigitalOceanError(
        res.status === 401
          ? "Token DigitalOcean ditolak. Periksa kembali token di Pengaturan."
          : res.status === 404
            ? "Resource tidak ditemukan di akun DigitalOcean."
            : res.status === 422
              ? `DigitalOcean menolak konfigurasi: ${safe}`
              : `DigitalOcean sedang bermasalah (${res.status}). Coba lagi beberapa saat.`,
        res.status,
        "do_api",
      );
    }

    if (res.status === 204) return {} as T;
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof DigitalOceanError) throw error;
    if ((error as Error).name === "AbortError") {
      if (attempt < 2) return request<T>(path, init, attempt + 1);
      throw new DigitalOceanError("Koneksi ke DigitalOcean timeout. Coba lagi.", 504, "timeout");
    }
    throw new DigitalOceanError("Tidak dapat menghubungi DigitalOcean.", 502, "network");
  } finally {
    clearTimeout(timer);
  }
}

function mockIp(): string {
  return `203.0.113.${10 + Math.floor(Math.random() * 240)}`;
}

function mockDroplet(name: string, region: string, size: string, image: string, tags: string[]): DoDroplet {
  const fakeId = Number(`${Date.now()}`.slice(-9));
  return {
    id: fakeId,
    name,
    status: "active",
    memory: MOCK_SIZES.find((s) => s.slug === size)?.memory ?? 1024,
    vcpus: MOCK_SIZES.find((s) => s.slug === size)?.vcpus ?? 1,
    disk: MOCK_SIZES.find((s) => s.slug === size)?.disk ?? 25,
    region: { slug: region, name: region.toUpperCase() },
    image: { slug: image, name: image },
    size_slug: size,
    ipv4: mockIp(),
    ipv6: `2001:db8:${Math.floor(Math.random() * 9999)}::1`,
    tags,
    created_at: new Date().toISOString(),
    rootPassword: uid("", 16),
  };
}

const mockDroplets = new Map<string, DoDroplet>();

function sizeFromSlug(slug: string) {
  return MOCK_SIZES.find((s) => s.slug === slug) ?? MOCK_SIZES[0];
}

/* ── Fungsi publik ────────────────────────────────────────── */
export async function testConnection(): Promise<{
  mock: boolean;
  account: DoAccount;
  dropletCount: number;
}> {
  const { mock } = config();
  if (mock) {
    return {
      mock: true,
      account: {
        email: "mock@pansavps.local",
        status: "active",
        droplet_limit: 25,
        floating_ip_limit: 5,
        email_verified: true,
        uuid: "mock-account",
      },
      dropletCount: mockDroplets.size,
    };
  }
  const account = await request<{ account: DoAccount }>("/account");
  const droplets = await request<{ droplets: unknown[]; meta?: { total?: number } }>("/droplets?per_page=1");
  return {
    mock: false,
    account: account.account,
    dropletCount: droplets.meta?.total ?? droplets.droplets.length,
  };
}

export async function listSizes(): Promise<DoSize[]> {
  const { mock } = config();
  if (mock) return MOCK_SIZES;
  const data = await request<{ sizes: DoSize[] }>("/sizes?per_page=200");
  return data.sizes;
}

export async function listRegions(): Promise<DoRegion[]> {
  const { mock } = config();
  if (mock) return MOCK_REGIONS;
  const data = await request<{ regions: DoRegion[] }>("/regions?per_page=200");
  return data.regions;
}

export async function listImages(): Promise<DoImage[]> {
  const { mock } = config();
  if (mock) return MOCK_IMAGES;
  const data = await request<{ images: DoImage[] }>("/images?type=distribution&per_page=200");
  return data.images.filter((i) => i.slug);
}

export async function createDroplet(input: {
  name: string;
  region: string;
  size: string;
  image: string;
  ssh_keys?: (string | number)[];
  tags: string[];
  user_data?: string;
}): Promise<DoDroplet> {
  const { mock } = config();
  if (mock) {
    const droplet = mockDroplet(input.name, input.region, input.size, input.image, input.tags);
    mockDroplets.set(String(droplet.id), droplet);
    return droplet;
  }
  const data = await request<{ droplet: DoDroplet; links?: Json }>("/droplets", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      region: input.region,
      size: input.size,
      image: input.image,
      ssh_keys: input.ssh_keys?.length ? input.ssh_keys : undefined,
      tags: input.tags,
      user_data: input.user_data,
      monitoring: true,
    }),
  });
  return data.droplet;
}

export async function getDroplet(id: string): Promise<DoDroplet | null> {
  const { mock } = config();
  if (mock) {
    return (
      mockDroplets.get(id) ?? {
        ...mockDroplet(`mock-${id}`, "sgp1", "s-1vcpu-1gb", "ubuntu-24-04-x64", ["vps-store"]),
        id: Number(id) || 1,
      }
    );
  }
  try {
    const data = await request<{ droplet: DoDroplet }>(`/droplets/${id}`);
    return data.droplet;
  } catch (error) {
    if (error instanceof DigitalOceanError && error.status === 404) return null;
    throw error;
  }
}

export async function listDropletsByTag(tag: string, page = 1): Promise<DoDroplet[]> {
  const { mock } = config();
  if (mock) {
    return [...mockDroplets.values()].filter((d) => d.tags.includes(tag));
  }
  const data = await request<{ droplets: DoDroplet[]; links?: { pages?: { next?: string } } }>(
    `/droplets?tag_name=${encodeURIComponent(tag)}&per_page=200&page=${page}`,
  );
  return data.droplets;
}

/** Ambil seluruh droplet di akun DigitalOcean (maksimal 10 halaman). */
export async function listDroplets(): Promise<DoDroplet[]> {
  const { mock } = config();
  if (mock) return [...mockDroplets.values()];

  const all: DoDroplet[] = [];
  for (let page = 1; page <= 10; page++) {
    const data = await request<{
      droplets: DoDroplet[];
      links?: { pages?: { next?: string } };
    }>(`/droplets?per_page=200&page=${page}`);
    all.push(...data.droplets);
    if (!data.links?.pages?.next || data.droplets.length === 0) break;
  }
  return all;
}

export async function dropletAction(
  id: string,
  action: DropletAction,
  extra: Record<string, unknown> = {},
): Promise<{ id: number; status: string }> {
  const { mock } = config();
  if (mock) return { id: Number(id) || 1, status: "completed" };
  const data = await request<{ action: { id: number; status: string } }>(
    `/droplets/${id}/actions`,
    { method: "POST", body: JSON.stringify({ type: action, ...extra }) },
  );
  return data.action;
}

export async function rebuildDroplet(id: string, image: string) {
  return dropletAction(id, "rebuild" as DropletAction, { image });
}

export async function resizeDroplet(id: string, size: string) {
  return dropletAction(id, "resize" as DropletAction, { size, disk: true });
}

export async function renameDroplet(id: string, name: string) {
  return dropletAction(id, "rename" as DropletAction, { name });
}

export async function snapshotDroplet(id: string, name: string) {
  return dropletAction(id, "snapshot" as DropletAction, { name });
}

export async function deleteDroplet(id: string): Promise<void> {
  const { mock } = config();
  if (mock) {
    mockDroplets.delete(id);
    return;
  }
  await request(`/droplets/${id}`, { method: "DELETE" });
}

export async function listSnapshotsByService(serviceId: string): Promise<
  { id: string; name: string; created_at: string }[]
> {
  const { mock } = config();
  if (mock) return [];
  const data = await request<{
    snapshots: { id: string | number; name: string; created_at: string; tags?: string[] }[];
  }>(`/snapshots?resource_type=droplet&per_page=200`);
  return data.snapshots
    .filter((s) => s.name.includes(serviceId))
    .map((s) => ({ id: String(s.id), name: s.name, created_at: s.created_at }));
}

export async function deleteSnapshot(id: string): Promise<void> {
  const { mock } = config();
  if (mock) return;
  await request(`/snapshots/${id}`, { method: "DELETE" });
}

/** Membuat SSH key di akun DO. Di mode mock hanya mengembalikan ID palsu. */
export async function createSshKey(name: string, publicKey: string): Promise<{ id: string; fingerprint: string }> {
  const { mock } = config();
  if (mock) return { id: `mock-ssh-${mockIp()}`, fingerprint: "mock:fingerprint" };
  const data = await request<{ ssh_key: { id: number; fingerprint: string } }>("/account/keys", {
    method: "POST",
    body: JSON.stringify({ name, public_key: publicKey }),
  });
  return { id: String(data.ssh_key.id), fingerprint: data.ssh_key.fingerprint };
}

export function mockRegistrationIp(): string {
  return mockIp();
}

export function sizeSpecs(slug: string) {
  return sizeFromSlug(slug);
}
