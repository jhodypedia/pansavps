/**
 * Worker WhatsApp (Baileys).
 *
 * Jalankan: npm run wa:worker
 * HTTP internal di WA_WORKER_URL (default http://127.0.0.1:3001) dengan
 * header x-internal-secret = INTERNAL_SECRET.
 */
import "dotenv/config";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import QRCode from "qrcode";
import pino from "pino";
import {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { and, asc, desc, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/core";
import { waOutbox, waState } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { formatDateTime, isValidPhone, normalizePhone, waJid } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { renderWaTemplate, waTemplateBody } from "@/lib/whatsapp/templates";

const PORT = Number(process.env.WA_WORKER_PORT ?? 3001);
const SECRET = process.env.INTERNAL_SECRET ?? "";
const AUTH_DIR = path.join(process.cwd(), "data", "wa-auth");
const logger = pino({ level: "silent" });

type Mode = "qr" | "pairing";

let sock: WASocket | null = null;
let mode: Mode = "qr";
let pairingPhone: string | null = null;
let pairingRequested = false;
let shuttingDown = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let outboxTimer: NodeJS.Timeout | null = null;
let outboxRun: Promise<{ sent: number; failed: number; skipped: number }> | null = null;
let startedAt = new Date();

function ensureState() {
  const row = db.select().from(waState).where(eq(waState.id, "singleton")).get();
  if (!row) {
    db.insert(waState).values({ id: "singleton", status: "disconnected" }).run();
  }
  return db.select().from(waState).where(eq(waState.id, "singleton")).get()!;
}

function updateState(values: Partial<typeof waState.$inferInsert>) {
  ensureState();
  db.update(waState)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(waState.id, "singleton"))
    .run();
}

function log(...args: unknown[]) {
  console.log(`[wa ${new Date().toISOString().slice(11, 19)}]`, ...args);
}

async function makeQrDataUrl(qr: string) {
  return QRCode.toDataURL(qr, { width: 320, margin: 1, errorCorrectionLevel: "M" });
}

function clearReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

async function startSocket(nextMode: Mode = mode, phone?: string | null) {
  clearReconnect();
  mode = nextMode;
  pairingPhone = phone ? normalizePhone(phone) : null;
  pairingRequested = false;

  if (sock) {
    try {
      (sock as unknown as { end: (error?: Error) => void }).end(undefined);
    } catch {
      // abaikan
    }
    sock = null;
  }

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  // eslint-disable-next-line react-hooks/rules-of-hooks -- bukan React hook, nama paket Baileys.
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined as never }));

  updateState({
    status: state.creds.registered ? "connecting" : nextMode === "pairing" ? "pairing_pending" : "qr_pending",
    lastError: null,
    pairingCode: null,
    lastQr: null,
  });

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      if (mode === "pairing" && pairingPhone && !pairingRequested) {
        pairingRequested = true;
        try {
          const code = await sock?.requestPairingCode(pairingPhone);
          updateState({
            status: "pairing_pending",
            pairingCode: code ?? null,
            lastQr: null,
            lastQrAt: null,
            lastError: null,
          });
          log(`kode pairing dibuat untuk +${pairingPhone}`);
        } catch (error) {
          updateState({
            status: "disconnected",
            lastError: error instanceof Error ? error.message : "Gagal membuat kode pairing.",
          });
          log("gagal pairing", error);
        }
      } else if (mode === "qr") {
        try {
          const dataUrl = await makeQrDataUrl(qr);
          updateState({
            status: "qr_pending",
            lastQr: dataUrl,
            lastQrAt: new Date(),
            pairingCode: null,
            lastError: null,
          });
          log("QR baru tersedia");
        } catch (error) {
          log("gagal membuat QR", error);
        }
      }
    }

    if (connection === "open") {
      const id = sock?.user?.id ?? "";
      const phone = id.split(":")[0]?.split("@")[0] ?? null;
      updateState({
        status: "connected",
        phone,
        profileName: sock?.user?.name ?? null,
        connectedAt: new Date(),
        lastQr: null,
        lastQrAt: null,
        pairingCode: null,
        lastError: null,
      });
      log(`terhubung sebagai +${phone ?? "?"}`);
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
        ?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      updateState({
        status: loggedOut ? "disconnected" : "connecting",
        lastError: loggedOut ? "Perangkat diputuskan." : "Koneksi terputus, mencoba menyambung ulang…",
      });
      if (loggedOut) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        log("logged out");
        return;
      }
      if (!shuttingDown) {
        clearReconnect();
        reconnectTimer = setTimeout(() => {
          startSocket(mode, pairingPhone).catch((error) => log("reconnect gagal", error));
        }, 3000);
      }
    }
  });
}

function isConnected() {
  return Boolean(sock?.user?.id) && ensureState().status === "connected";
}

async function processOutbox(limit = 10): Promise<{ sent: number; failed: number; skipped: number }> {
  if (!isConnected()) {
    return { sent: 0, failed: 0, skipped: 0 };
  }
  const now = new Date();
  const rows = db
    .select()
    .from(waOutbox)
    .where(
      and(eq(waOutbox.status, "queued"), lte(waOutbox.scheduledAt, now)),
    )
    .orderBy(desc(waOutbox.priority), asc(waOutbox.createdAt))
    .limit(limit)
    .all();

  let sent = 0;
  let failed = 0;
  const skipped = 0;

  for (const row of rows) {
    db.update(waOutbox)
      .set({ status: "sending", attempts: row.attempts + 1, updatedAt: new Date() })
      .where(eq(waOutbox.id, row.id))
      .run();

    const payload = { ...(row.payload ?? {}) } as Record<string, unknown>;
    if (typeof payload.password_enc === "string") {
      try {
        payload.password = decrypt(payload.password_enc);
      } catch {
        payload.password = "(tidak dapat didekripsi)";
      }
      delete payload.password_enc;
    }

    let body: string | null = null;
    if (row.templateKey === "test" || row.templateKey === "admin_custom" || row.templateKey === "custom") {
      body = typeof payload.message === "string" ? payload.message : null;
    } else {
      const template = waTemplateBody(row.templateKey);
      body = template ? renderWaTemplate(template, { ...payload, brand: getSettings().site_name }) : null;
    }

    if (!body) {
      db.update(waOutbox)
        .set({ status: "failed", lastError: "Template pesan tidak ditemukan.", updatedAt: new Date() })
        .where(eq(waOutbox.id, row.id))
        .run();
      failed++;
      continue;
    }

    try {
      await sock!.sendMessage(waJid(row.toNumber), { text: body });
      db.update(waOutbox)
        .set({ status: "sent", sentAt: new Date(), lastError: null, updatedAt: new Date() })
        .where(eq(waOutbox.id, row.id))
        .run();
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengirim pesan.";
      db.update(waOutbox)
        .set({ status: "failed", lastError: message.slice(0, 500), updatedAt: new Date() })
        .where(eq(waOutbox.id, row.id))
        .run();
      failed++;
    }
  }

  return { sent, failed, skipped };
}

/**
 * Jalankan antrean tanpa tumpang tindih. Timer internal dan endpoint cron
 * memakai lock yang sama supaya pesan tidak terkirim dua kali.
 */
function processOutboxNow(limit = 20): Promise<{ sent: number; failed: number; skipped: number }> {
  if (outboxRun) return outboxRun;

  outboxRun = processOutbox(limit)
    .catch((error) => {
      log("outbox gagal", error);
      return { sent: 0, failed: 0, skipped: 0 };
    })
    .finally(() => {
      outboxRun = null;
    });

  return outboxRun;
}

function startOutboxLoop() {
  if (outboxTimer) return;
  // Polling cepat membuat pesan verifikasi terkirim dalam hitungan detik,
  // tanpa menunggu timer cron satu menit.
  outboxTimer = setInterval(() => {
    if (!isConnected()) return;
    void processOutboxNow();
  }, 1000);
}

type Json = Record<string, unknown>;

async function readJson(request: http.IncomingMessage): Promise<Json> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Json;
  } catch {
    return {};
  }
}

function send(res: http.ServerResponse, status: number, data: Json) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function handle(request: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname;

  if (request.method === "GET" && pathname === "/health") {
    send(res, 200, { ok: true, status: ensureState().status, uptime: Date.now() - startedAt.getTime() });
    return;
  }

  if (SECRET && request.headers["x-internal-secret"] !== SECRET) {
    send(res, 401, { message: "Secret tidak valid." });
    return;
  }

  if (request.method === "GET" && pathname === "/status") {
    const state = ensureState();
    send(res, 200, {
      status: state.status,
      phone: state.phone,
      profileName: state.profileName,
      connectedAt: state.connectedAt ? formatDateTime(state.connectedAt) : null,
      lastError: state.lastError,
      connected: isConnected(),
    });
    return;
  }

  if (request.method === "POST" && pathname === "/pair") {
    const body = await readJson(request);
    const nextMode = body.mode === "pairing" ? "pairing" : "qr";
    const phone = typeof body.phone === "string" ? body.phone : null;
    if (nextMode === "pairing" && (!phone || !isValidPhone(phone))) {
      send(res, 400, { message: "Nomor pairing tidak valid." });
      return;
    }
    try {
      await startSocket(nextMode, phone);
      send(res, 200, {
        message:
          nextMode === "pairing"
            ? "Permintaan kode pairing dikirim. Tunggu beberapa detik lalu segarkan status."
            : "Permintaan QR dikirim. Tunggu beberapa detik lalu segarkan status.",
      });
    } catch (error) {
      send(res, 500, {
        message: error instanceof Error ? error.message : "Gagal memulai koneksi WhatsApp.",
      });
    }
    return;
  }

  if (request.method === "POST" && pathname === "/logout") {
    try {
      if (sock) {
        await sock.logout().catch(() => undefined);
        (sock as unknown as { end: (error?: Error) => void }).end(undefined);
        sock = null;
      }
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      updateState({
        status: "disconnected",
        phone: null,
        profileName: null,
        connectedAt: null,
        lastQr: null,
        lastQrAt: null,
        pairingCode: null,
        lastError: null,
      });
      send(res, 200, { message: "WhatsApp diputuskan." });
    } catch (error) {
      send(res, 500, { message: error instanceof Error ? error.message : "Gagal logout." });
    }
    return;
  }

  if (request.method === "POST" && pathname === "/process-outbox") {
    try {
      const result = await processOutboxNow(20);
      send(res, 200, { message: "Antrean diproses.", ...result });
    } catch (error) {
      send(res, 500, { message: error instanceof Error ? error.message : "Gagal memproses antrean." });
    }
    return;
  }

  send(res, 404, { message: "Endpoint tidak ditemukan." });
}

async function main() {
  ensureState();
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  // eslint-disable-next-line react-hooks/rules-of-hooks -- bukan React hook, nama paket Baileys.
  const { state } = await useMultiFileAuthState(AUTH_DIR);
  // `registered` bisa false meski sesi lama masih valid; `me` menandakan kredensial tersimpan.
  if (state.creds.registered || state.creds.me) {
    await startSocket("qr").catch((error) => {
      log("gagal memulai socket", error);
      updateState({
        status: "disconnected",
        lastError: error instanceof Error ? error.message : "Gagal memulai koneksi.",
      });
    });
  } else {
    updateState({ status: "disconnected", lastError: null });
  }

  const server = http.createServer((request, res) => {
    handle(request, res).catch((error) => {
      log("request gagal", error);
      if (!res.headersSent) send(res, 500, { message: "Internal error." });
    });
  });

  server.listen(PORT, "127.0.0.1", () => {
    startedAt = new Date();
    log(`worker berjalan di http://127.0.0.1:${PORT}`);
    startOutboxLoop();
    void processOutboxNow();
  });

  const shutdown = async () => {
    shuttingDown = true;
    clearReconnect();
    if (outboxTimer) {
      clearInterval(outboxTimer);
      outboxTimer = null;
    }
    server.close();
    try {
      (sock as unknown as { end: (error?: Error) => void } | null)?.end(undefined);
    } catch {
      // abaikan
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[wa] fatal", error);
  process.exit(1);
});
