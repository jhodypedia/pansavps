import "server-only";

import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { doAccounts, services, settings, type DoAccount } from "@/lib/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { uid } from "@/lib/format";
import { getSetting } from "@/lib/settings";
import type { DoAccountView } from "@/lib/do-account-types";

export type DoAccountWithToken = {
  id: string;
  name: string;
  token: string;
  isDefault: boolean;
  isActive: boolean;
};

function decryptToken(row: DoAccount): string {
  try {
    return decrypt(row.tokenEncrypted);
  } catch {
    return "";
  }
}

function toAccount(row: DoAccount): DoAccountWithToken {
  return {
    id: row.id,
    name: row.name,
    token: decryptToken(row),
    isDefault: row.isDefault,
    isActive: row.isActive,
  };
}

function tokenHint(token: string): string {
  if (!token) return "Token belum terbaca";
  if (token.length <= 12) return "••••••••";
  return `${token.slice(0, 8)}…${token.slice(-4)}`;
}

/**
 * Pindahkan token lama dari settings.do_token ke tabel do_accounts satu kali.
 * Token lama dikosongkan setelah migrasi agar tidak dipakai sebagai fallback
 * diam-diam ketika admin menghapus akun.
 */
export function ensureLegacyDoAccount(): void {
  const existing = db.select({ id: doAccounts.id }).from(doAccounts).limit(1).get();
  if (existing) return;
  const legacy = getSetting("do_token");
  if (!legacy) return;

  db.transaction((tx) => {
    const again = tx.select({ id: doAccounts.id }).from(doAccounts).limit(1).get();
    if (again) return;
    tx.insert(doAccounts)
      .values({
        id: uid("doa_", 12),
        name: "Akun Utama",
        tokenEncrypted: encrypt(legacy),
        isDefault: true,
        isActive: true,
      })
      .run();
    tx.update(settings)
      .set({ value: "", updatedBy: "system", updatedAt: new Date() })
      .where(eq(settings.key, "do_token"))
      .run();
  });
}

export function listDoAccounts(): DoAccount[] {
  ensureLegacyDoAccount();
  return db
    .select()
    .from(doAccounts)
    .orderBy(desc(doAccounts.isDefault), asc(doAccounts.createdAt))
    .all();
}

export function listDoAccountsSafe(): DoAccountView[] {
  return listDoAccounts().map((row) => ({
    id: row.id,
    name: row.name,
    tokenHint: tokenHint(decryptToken(row)),
    isDefault: row.isDefault,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export function getActiveDoAccounts(): DoAccountWithToken[] {
  return listDoAccounts()
    .filter((row) => row.isActive)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
    .map(toAccount)
    .filter((account) => Boolean(account.token));
}

export function getDefaultDoAccount(): DoAccountWithToken | null {
  const rows = getActiveDoAccounts();
  return rows.find((row) => row.isDefault) ?? rows[0] ?? null;
}

export function getDoAccountById(id: string): DoAccountWithToken | null {
  const row = db.select().from(doAccounts).where(eq(doAccounts.id, id)).get();
  return row ? toAccount(row) : null;
}

export function resolveDoAccount(id?: string | null): DoAccountWithToken | null {
  if (id) return getDoAccountById(id);
  return getDefaultDoAccount();
}

/** Lengkapi service lama dengan akun default agar aksi droplet tetap terarah. */
export function ensureDoAccountSetup(): void {
  ensureLegacyDoAccount();
  const fallback = getDefaultDoAccount();
  if (!fallback) return;
  db.update(services)
    .set({ doAccountId: fallback.id })
    .where(isNull(services.doAccountId))
    .run();
}

export function createDoAccount(input: {
  name: string;
  token: string;
  isDefault?: boolean;
  isActive?: boolean;
}): string {
  ensureLegacyDoAccount();
  const count = db.select({ id: doAccounts.id }).from(doAccounts).all().length;
  const makeDefault = input.isDefault === true || count === 0;
  const makeActive = input.isActive !== false || count === 0;
  const id = uid("doa_", 12);
  db.transaction((tx) => {
    if (makeDefault) {
      tx.update(doAccounts).set({ isDefault: false }).run();
    }
    tx.insert(doAccounts)
      .values({
        id,
        name: input.name.trim(),
        tokenEncrypted: encrypt(input.token.trim()),
        isDefault: makeDefault,
        isActive: makeActive,
      })
      .run();
  });
  return id;
}

export function updateDoAccount(input: {
  id: string;
  name: string;
  token?: string;
  isDefault?: boolean;
  isActive?: boolean;
}): void {
  const row = db.select().from(doAccounts).where(eq(doAccounts.id, input.id)).get();
  if (!row) throw new Error("Akun DigitalOcean tidak ditemukan.");

  if (input.isActive === false) {
    const otherActive = db
      .select({ id: doAccounts.id })
      .from(doAccounts)
      .where(and(eq(doAccounts.isActive, true), ne(doAccounts.id, input.id)))
      .get();
    if (!otherActive) throw new Error("Minimal satu akun DigitalOcean harus aktif.");
  }

  db.transaction((tx) => {
    if (input.isDefault) {
      tx.update(doAccounts).set({ isDefault: false }).run();
    }
    tx.update(doAccounts)
      .set({
        name: input.name.trim(),
        ...(input.token?.trim() ? { tokenEncrypted: encrypt(input.token.trim()) } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(doAccounts.id, input.id))
      .run();
  });
}

export function setDefaultDoAccount(id: string): void {
  const row = db.select().from(doAccounts).where(eq(doAccounts.id, id)).get();
  if (!row) throw new Error("Akun DigitalOcean tidak ditemukan.");
  if (!row.isActive) throw new Error("Aktifkan akun terlebih dahulu sebelum menjadikannya default.");
  db.transaction((tx) => {
    tx.update(doAccounts).set({ isDefault: false }).run();
    tx.update(doAccounts)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(doAccounts.id, id))
      .run();
  });
}

export function deleteDoAccount(id: string): void {
  const rows = db.select().from(doAccounts).all();
  if (rows.length <= 1) {
    throw new Error("Minimal satu akun DigitalOcean harus tersedia.");
  }
  const row = rows.find((item) => item.id === id);
  if (!row) throw new Error("Akun DigitalOcean tidak ditemukan.");

  const used = db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.doAccountId, id), ne(services.status, "terminated")))
    .get();
  if (used) {
    throw new Error("Akun masih dipakai layanan aktif. Terminasi atau pindahkan layanan terlebih dahulu.");
  }

  db.transaction((tx) => {
    tx.delete(doAccounts).where(eq(doAccounts.id, id)).run();
    if (row.isDefault) {
      const next = tx
        .select()
        .from(doAccounts)
        .orderBy(desc(doAccounts.isActive), asc(doAccounts.createdAt))
        .limit(1)
        .get();
      if (next) {
        tx.update(doAccounts)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(doAccounts.id, next.id))
          .run();
      }
    }
  });
}
