"use client";

import { Check, CheckCircle2, CircleAlert, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STRENGTHS = [
  { label: "Sangat lemah", color: "bg-[#DC2626]", text: "text-[#B91C1C]" },
  { label: "Lemah", color: "bg-[#F97316]", text: "text-[#C2410C]" },
  { label: "Cukup", color: "bg-[#D97706]", text: "text-[#B45309]" },
  { label: "Kuat", color: "bg-[#16A34A]", text: "text-[#15803D]" },
  { label: "Sangat kuat", color: "bg-[#0B3D2E]", text: "text-[#0B3D2E]" },
];

function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    number: /[0-9]/.test(password),
    long: password.length >= 12,
    upper: /[A-Z]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

export function isPasswordReady(password: string): boolean {
  const checks = passwordChecks(password);
  return checks.length && checks.letter && checks.number;
}

export function PasswordFeedback({
  password,
  confirmPassword,
}: {
  password: string;
  confirmPassword: string;
}) {
  const checks = passwordChecks(password);
  const requirements = [
    { met: checks.length, label: "Minimal 8 karakter" },
    { met: checks.letter, label: "Mengandung huruf" },
    { met: checks.number, label: "Mengandung angka" },
  ];
  const allRequiredMet = requirements.every((item) => item.met);
  let score = 0;
  if (password.length > 0) {
    score = 1;
    if (allRequiredMet) score = 2;
    if (allRequiredMet && (checks.long || (checks.upper && checks.symbol))) score = 3;
    if (allRequiredMet && checks.long && checks.upper && checks.symbol) score = 4;
  }
  const strength = password.length === 0 ? null : STRENGTHS[score];
  const confirmMatches = confirmPassword.length > 0 && password === confirmPassword;

  return (
    <div className="space-y-3" aria-live="polite">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-[#5B6B60]">Kekuatan password</p>
          <p
            className={cn(
              "text-[11px] font-bold transition-colors duration-300",
              strength ? strength.text : "text-[#A3B0A7]",
            )}
          >
            {strength ? strength.label : "Belum diisi"}
          </p>
        </div>
        <div className="grid grid-cols-5 gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500 ease-out",
                index < score ? strength?.color ?? "bg-[#D8E2DB]" : "bg-[#E8EEEA]",
              )}
              style={{ transform: index < score ? "scaleY(1.25)" : "scaleY(1)" }}
            />
          ))}
        </div>
      </div>

      <div
        className={cn(
          "rounded-xl border p-3.5 transition-all duration-300",
          allRequiredMet
            ? "border-[#BFE3CC] bg-[#F1FAF4]"
            : "border-[#FDE68A] bg-[#FFFBEB]",
        )}
      >
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300",
              allRequiredMet
                ? "bg-[#16A34A] text-white"
                : "bg-[#FEF3C7] text-[#B45309]",
            )}
          >
            {allRequiredMet ? <ShieldCheck className="size-4" /> : <Sparkles className="size-4" />}
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                "text-xs font-bold transition-colors duration-300",
                allRequiredMet ? "text-[#0B3D2E]" : "text-[#92400E]",
              )}
            >
              {allRequiredMet ? "Password sudah memenuhi syarat" : "Syarat password"}
            </p>
            <p
              className={cn(
                "mt-0.5 text-[11px] leading-relaxed transition-colors duration-300",
                allRequiredMet ? "text-[#5B6B60]" : "text-[#A16207]",
              )}
            >
              {allRequiredMet
                ? confirmMatches
                  ? "Kamu bisa melanjutkan pendaftaran. Tambahkan variasi agar makin kuat."
                  : "Syarat password terpenuhi. Ulangi password yang sama untuk melanjutkan."
                : "Centang akan muncul otomatis saat syarat terpenuhi."}
            </p>
          </div>
        </div>

        <ul className="mt-3 grid gap-1.5 sm:grid-cols-3">
          {requirements.map((item) => (
            <li
              key={item.label}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition-all duration-300",
                item.met
                  ? "border-[#BFE3CC] bg-white text-[#0B3D2E]"
                  : "border-transparent bg-white/70 text-[#8A9A90]",
              )}
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                  item.met
                    ? "scale-100 bg-[#16A34A] text-white"
                    : "scale-90 bg-[#E3E8E4] text-[#A3B0A7]",
                )}
              >
                {item.met ? <Check className="size-2.5" /> : <span className="size-1 rounded-full bg-current" />}
              </span>
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      {confirmPassword.length > 0 ? (
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-300",
            confirmMatches
              ? "border-[#BFE3CC] bg-[#F1FAF4] text-[#0B3D2E]"
              : "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]",
          )}
        >
          {confirmMatches ? (
            <CheckCircle2 className="size-4 text-[#16A34A]" />
          ) : (
            <CircleAlert className="size-4 text-[#DC2626]" />
          )}
          {confirmMatches ? "Password cocok" : "Password belum cocok"}
        </div>
      ) : null}
    </div>
  );
}
