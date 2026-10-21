import "server-only";

import { z } from "zod";
import type { ActionResult } from "./types";

export function fail<T = unknown>(
  message: string,
  fieldErrors?: Record<string, string[]>,
  silent = false,
): ActionResult<T> {
  return { ok: false, message, fieldErrors, ...(silent ? { silent: true } : {}) };
}

export function done<T = unknown>(
  message: string,
  extra?: Omit<ActionResult<T>, "ok" | "message">,
): ActionResult<T> {
  return { ok: true, message, ...extra };
}

export function fromZod<T = unknown>(error: z.ZodError): ActionResult<T> {
  const flat = z.flattenError(error);
  const first = Object.values(flat.fieldErrors).flat().filter(Boolean)[0] as
    | string
    | undefined;
  const formError = flat.formErrors[0] as string | undefined;
  // Jangan tampilkan pesan teknis bawaan Zod (mis. "Invalid input: expected
  // string, received null") ke pengguna.
  const friendly = first && !/^Invalid input:/i.test(first) ? first : formError;
  return {
    ok: false,
    message: friendly || "Periksa kembali data yang kamu isi.",
    fieldErrors: flat.fieldErrors as Record<string, string[]>,
  };
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === "FORBIDDEN") return "Kamu tidak memiliki akses ke data ini.";
    return error.message;
  }
  return "Terjadi kesalahan. Coba lagi.";
}

export function safeNext(value: FormDataEntryValue | null, fallback = "/dashboard"): string {
  const raw = typeof value === "string" ? value : "";
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (raw.includes("\\")) return fallback;
  return raw;
}

export function formString(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function formBool(data: FormData, key: string): boolean {
  const value = data.get(key);
  return value === "on" || value === "true" || value === "1";
}

export function formNumber(data: FormData, key: string): number {
  return Number(formString(data, key));
}
