import "server-only";

import { getSettings } from "@/lib/settings";

export type TurnstileConfig = {
  enabled: boolean;
  siteKey: string;
};

export function getTurnstileConfig(): TurnstileConfig {
  const settings = getSettings();
  const enabled =
    settings.captcha_enabled === "true" &&
    Boolean(settings.turnstile_site_key) &&
    Boolean(settings.turnstile_secret_key);
  return {
    enabled,
    siteKey: enabled ? settings.turnstile_site_key : "",
  };
}

export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string,
): Promise<boolean> {
  const settings = getSettings();
  if (settings.captcha_enabled !== "true") return true;
  // Jangan mengunci semua pengguna jika admin mengaktifkan captcha tetapi
  // kunci belum lengkap. Admin tetap melihat peringatan di panel.
  if (!settings.turnstile_site_key || !settings.turnstile_secret_key) return true;
  if (!token) return false;

  try {
    const body = new URLSearchParams({
      secret: settings.turnstile_secret_key,
      response: token,
    });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    console.error("[turnstile] verifikasi gagal", error);
    return false;
  }
}
