"use server";

import { randomInt } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { authTokens, users } from "@/lib/db/schema";
import {
  createSession,
  destroyCurrentSession,
  getSessionUser,
  hashPassword,
  isUserVerified,
  verifyPassword,
} from "@/lib/auth";
import { clientMeta } from "@/lib/auth";
import { randomToken, sha256 } from "@/lib/crypto";
import { isSmtpConfigured, sendTemplatedEmail } from "@/lib/email";
import { getSettings } from "@/lib/settings";
import { notifyUserEvent } from "@/lib/notifications";
import { isWhatsAppConnected, queueWhatsApp } from "@/lib/whatsapp/queue";
import { auditLogin } from "@/lib/audit-login";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { uid } from "@/lib/format";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validators";
import type { ActionResult } from "./types";
import { done, errorMessage, fail, fromZod, safeNext } from "./utils";

const HOUR = 60 * 60 * 1000;
const PHONE_CODE_TTL = 10 * 60 * 1000;

type VerificationChannel = "whatsapp" | "email";

function randomVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function appUrl(path: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

async function storeToken(
  userId: string,
  type: "email_verify" | "phone_verify" | "password_reset",
  rawToken: string,
  ttlMs: number,
): Promise<void> {
  db.delete(authTokens)
    .where(and(eq(authTokens.userId, userId), eq(authTokens.type, type)))
    .run();
  db.insert(authTokens)
    .values({
      id: uid("tok_", 16),
      userId,
      type,
      tokenHash: sha256(rawToken),
      expiresAt: new Date(Date.now() + ttlMs),
    })
    .run();
}

async function issueToken(
  userId: string,
  type: "email_verify" | "phone_verify" | "password_reset",
  ttlMs: number,
): Promise<string> {
  const token = randomToken(32);
  await storeToken(userId, type, token, ttlMs);
  return token;
}

async function sendVerificationMessages(user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}): Promise<{ channels: VerificationChannel[]; errors: string[] }> {
  const settings = getSettings();
  const channels: VerificationChannel[] = [];
  const errors: string[] = [];

  // WhatsApp diprioritaskan karena kode langsung terlihat di aplikasi.
  if (settings.wa_enabled === "true" && user.phone) {
    if (!isWhatsAppConnected()) {
      errors.push(
        "WhatsApp belum terhubung. Kode verifikasi tidak dikirim. Hubungi admin atau gunakan verifikasi email.",
      );
    } else {
      try {
        const code = randomVerificationCode();
        await storeToken(user.id, "phone_verify", code, PHONE_CODE_TTL);
        const queued = queueWhatsApp({
          to: user.phone,
          templateKey: "verification",
          payload: {
            nama: user.name,
            code,
            email: user.email,
            brand: settings.site_name,
          },
          priority: 10,
        });
        if (queued) channels.push("whatsapp");
        else errors.push("Kode WhatsApp belum dapat dikirim. Pastikan template verifikasi aktif.");
      } catch (error) {
        console.error("[auth] gagal mengirim kode verifikasi WhatsApp", error);
        errors.push("Kode WhatsApp gagal dibuat. Coba lagi nanti.");
      }
    }
  }

  // Email hanya diproses jika SMTP benar-benar dikonfigurasi.
  if (isSmtpConfigured()) {
    try {
      const token = await issueToken(user.id, "email_verify", 24 * HOUR);
      const link = appUrl(`/verifikasi-akun?token=${token}`);
      const res = await sendTemplatedEmail(user.email, "verification", {
        nama: user.name,
        link,
        email: user.email,
      });
      if (res.ok && !res.logged) channels.push("email");
      else errors.push(res.error ?? "Email verifikasi gagal dikirim.");
    } catch (error) {
      console.error("[auth] gagal mengirim email verifikasi", error);
      errors.push("Email verifikasi gagal dikirim.");
    }
  }

  return { channels, errors };
}

function verificationMessage(channels: VerificationChannel[], errors: string[]): string {
  const whatsapp = channels.includes("whatsapp");
  const email = channels.includes("email");
  if (whatsapp && email) {
    return "Kode verifikasi WhatsApp dan tautan email sudah dikirim. WhatsApp diprioritaskan.";
  }
  if (whatsapp) return "Kode verifikasi sudah dikirim via WhatsApp.";
  if (email) return "Tautan verifikasi sudah dikirim via email.";
  return errors[0] ?? "Belum ada channel verifikasi yang aktif. Hubungi admin untuk verifikasi manual.";
}

function waitLabel(seconds: number): string {
  if (seconds >= 60) return `${Math.ceil(seconds / 60)} menit`;
  return `${seconds} detik`;
}

function retryResult(message: string, retryAfterSeconds: number): ActionResult<{ retryAfterSeconds: number }> {
  return { ok: false, message, data: { retryAfterSeconds } };
}

async function checkCaptcha(formData: FormData, ip: string): Promise<ActionResult | null> {
  const token = formData.get("cf-turnstile-response")?.toString() ?? null;
  const ok = await verifyTurnstile(token, ip);
  return ok
    ? null
    : fail("Verifikasi keamanan gagal. Selesaikan Turnstile lalu coba lagi.");
}

export async function registerAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    phone: formData.get("phone") || "",
    acceptTerms: formData.get("acceptTerms") === "on" ? true : false,
  });
  if (!parsed.success) return fromZod(parsed.error);
  const input = parsed.data;

  const meta = await clientMeta();
  const limit = rateLimit(`register:${meta.ip}`, 5, 15 * 60 * 1000);
  if (!limit.ok) return fail("Terlalu banyak percobaan. Coba lagi beberapa menit lagi.");
  const captcha = await checkCaptcha(formData, meta.ip);
  if (captcha) return captcha;

  const existing = db.select().from(users).where(eq(users.email, input.email)).get();
  if (existing) {
    return fail("Email sudah terdaftar. Silakan masuk atau reset password.", {
      email: ["Email sudah terdaftar."],
    });
  }

  const userId = uid("usr_", 14);
  const passwordHash = await hashPassword(input.password);
  db.insert(users)
    .values({
      id: userId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: "user",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();

  await createSession(userId);
  await auditLogin({ userId, email: input.email, action: "register" });

  try {
    const verification = await sendVerificationMessages({
      id: userId,
      name: input.name,
      email: input.email,
      phone: input.phone,
    });
    if (verification.errors.length > 0) {
      console.warn("[auth] sebagian verifikasi gagal dikirim", verification.errors);
    }
  } catch (error) {
    console.error("[auth] gagal mengirim verifikasi", error);
  }

  try {
    await notifyUserEvent({
      userId,
      event: "welcome",
      title: "Selamat datang",
      body: `Akun kamu berhasil dibuat. Verifikasi akun lewat kode WhatsApp atau tautan email agar bisa mulai memesan VPS.`,
      link: "/verifikasi-akun",
    });
  } catch (error) {
    console.error("[auth] notifikasi welcome gagal", error);
  }

  return done("Akun berhasil dibuat. Verifikasi akun untuk mulai membeli VPS.", {
    redirectTo: safeNext(formData.get("next"), "/dashboard"),
  });
}

export async function loginAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) return fromZod(parsed.error);

  const meta = await clientMeta();
  const key = `login:${parsed.data.email}:${meta.ip}`;
  const limit = rateLimit(key, 8, 15 * 60 * 1000);
  if (!limit.ok) {
    return fail(
      `Terlalu banyak percobaan masuk. Coba lagi dalam ${Math.ceil(limit.retryAfterSeconds / 60)} menit.`,
    );
  }
  const captcha = await checkCaptcha(formData, meta.ip);
  if (captcha) return captcha;

  const user = db.select().from(users).where(eq(users.email, parsed.data.email)).get();
  if (!user) return fail("Email atau password salah.");
  if (user.status !== "active") {
    return fail("Akun kamu sedang ditangguhkan. Hubungi support untuk bantuan.");
  }
  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) return fail("Email atau password salah.");

  db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)).run();
  await createSession(user.id);
  await auditLogin({ userId: user.id, email: user.email, action: "login" });

  const fallback = user.role === "admin" ? "/admin" : "/dashboard";
  const next = safeNext(formData.get("next"), fallback);
  return done("Berhasil masuk.", {
    redirectTo: next.startsWith("/admin") && user.role !== "admin" ? "/dashboard" : next,
  });
}

export async function logoutAction(): Promise<void> {
  const user = await getSessionUser();
  if (user) await auditLogin({ userId: user.id, email: user.email, action: "logout" });
  await destroyCurrentSession();
  redirect("/");
}

export async function forgotPasswordAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return fromZod(parsed.error);

  const meta = await clientMeta();
  const limit = rateLimit(`forgot:${meta.ip}`, 4, 15 * 60 * 1000);
  if (!limit.ok) return fail("Terlalu banyak permintaan. Coba lagi beberapa menit lagi.");
  const captcha = await checkCaptcha(formData, meta.ip);
  if (captcha) return captcha;

  const user = db.select().from(users).where(eq(users.email, parsed.data.email)).get();
  if (user && user.status === "active") {
    try {
      const token = await issueToken(user.id, "password_reset", HOUR);
      const link = appUrl(`/reset-password?token=${token}`);
      await sendTemplatedEmail(user.email, "password_reset", {
        nama: user.name,
        link,
        email: user.email,
      });
    } catch (error) {
      console.error("[auth] gagal mengirim reset password", error);
    }
  }

  return done(
    "Jika email terdaftar, tautan reset password sudah dikirim. Periksa kotak masuk dan folder spam.",
  );
}

export async function resetPasswordAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return fromZod(parsed.error);

  const meta = await clientMeta();
  const limit = rateLimit(`reset:${meta.ip}`, 6, 15 * 60 * 1000);
  if (!limit.ok) return fail("Terlalu banyak percobaan. Coba lagi beberapa menit lagi.");
  const captcha = await checkCaptcha(formData, meta.ip);
  if (captcha) return captcha;

  const tokenHash = sha256(parsed.data.token);
  const row = db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, tokenHash),
        eq(authTokens.type, "password_reset"),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .get();
  if (!row) return fail("Tautan reset tidak valid atau sudah kedaluwarsa.");

  const passwordHash = await hashPassword(parsed.data.password);
  db.transaction((tx) => {
    tx.update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, row.userId))
      .run();
    tx.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id)).run();
  });
  const { sessions } = await import("@/lib/db/schema");
  db.delete(sessions).where(eq(sessions.userId, row.userId)).run();

  try {
    await notifyUserEvent({
      userId: row.userId,
      event: "password_reset",
      title: "Password diubah",
      body: "Password akun kamu baru saja diubah. Semua sesi lain sudah dikeluarkan.",
      link: "/login",
      emailVars: { link: "/login" },
      notifyEmail: false,
    });
  } catch {
    // abaikan kegagalan notifikasi
  }

  return done("Password berhasil diperbarui. Silakan masuk dengan password baru.", {
    redirectTo: "/login",
  });
}

export async function verifyEmailAction(token: string): Promise<ActionResult> {
  if (!token) return fail("Token verifikasi tidak ditemukan.");
  const row = db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, sha256(token)),
        eq(authTokens.type, "email_verify"),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .get();
  if (!row) return fail("Tautan verifikasi tidak valid atau sudah kedaluwarsa.");
  db.transaction((tx) => {
    tx.update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, row.userId))
      .run();
    tx.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id)).run();
  });
  return done("Email berhasil diverifikasi.", { redirectTo: "/dashboard" });
}

export async function verifyPhoneCodeAction(code: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir. Silakan masuk kembali.");
  if (user.phoneVerifiedAt) return done("Nomor WhatsApp sudah terverifikasi.", { redirectTo: "/dashboard" });
  if (!user.phone) {
    return fail("Nomor WhatsApp belum diisi. Lengkapi profil terlebih dahulu.", {
      phone: ["Nomor WhatsApp belum diisi."],
    });
  }

  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return fail("Masukkan 6 digit kode verifikasi WhatsApp.");

  const meta = await clientMeta();
  const limit = rateLimit(`verify-code:${user.id}:${meta.ip}`, 5, 10 * 60 * 1000);
  if (!limit.ok) {
    return fail("Terlalu banyak percobaan kode. Tunggu beberapa menit lalu coba lagi.");
  }

  const row = db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.userId, user.id),
        eq(authTokens.type, "phone_verify"),
        eq(authTokens.tokenHash, sha256(clean)),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .get();
  if (!row) return fail("Kode verifikasi salah atau sudah kedaluwarsa. Minta kode baru jika perlu.");

  const now = new Date();
  db.transaction((tx) => {
    tx.update(users)
      .set({ phoneVerifiedAt: now, updatedAt: now })
      .where(eq(users.id, user.id))
      .run();
    tx.update(authTokens).set({ usedAt: now }).where(eq(authTokens.id, row.id)).run();
  });
  return done("Nomor WhatsApp berhasil diverifikasi.", { redirectTo: "/dashboard" });
}

export async function resendVerificationAction(): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Sesi berakhir. Silakan masuk kembali.");
  if (isUserVerified(user)) return done("Akun kamu sudah terverifikasi.");

  // Cooldown 60 detik per akun. Cek ini lebih dulu agar klik berulang
  // tidak ikut menghabiskan kuota permintaan 10 menit.
  const cooldown = rateLimit(`verify-cooldown:${user.id}`, 1, 60 * 1000);
  if (!cooldown.ok) {
    return retryResult(
      `Tunggu ${waitLabel(cooldown.retryAfterSeconds)} sebelum mengirim ulang kode atau tautan.`,
      cooldown.retryAfterSeconds,
    );
  }

  const limit = rateLimit(`verify:${user.id}`, 3, 10 * 60 * 1000);
  if (!limit.ok) {
    return retryResult(
      `Batas permintaan verifikasi tercapai. Coba lagi dalam ${waitLabel(limit.retryAfterSeconds)}.`,
      limit.retryAfterSeconds,
    );
  }

  try {
    const verification = await sendVerificationMessages({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
    });
    if (verification.channels.length === 0) {
      return retryResult(verificationMessage(verification.channels, verification.errors), 60);
    }
    return done(verificationMessage(verification.channels, verification.errors), {
      data: { retryAfterSeconds: 60 },
    });
  } catch (error) {
    return retryResult(errorMessage(error), 60);
  }
}
