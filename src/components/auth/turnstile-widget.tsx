"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileWidgetConfig = {
  enabled: boolean;
  siteKey: string;
};

const SCRIPT_ID = "cf-turnstile-script";

function loadScript(onReady: () => void): () => void {
  if (window.turnstile) {
    onReady();
    return () => undefined;
  }

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    existing.addEventListener("load", onReady);
    return () => existing.removeEventListener("load", onReady);
  }

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.defer = true;
  script.addEventListener("load", onReady);
  document.head.appendChild(script);

  return () => script.removeEventListener("load", onReady);
}

export function scheduleTurnstileReset(delay = 1500) {
  if (typeof window === "undefined") return;
  window.setTimeout(() => window.dispatchEvent(new Event("turnstile:reset")), delay);
}

export function TurnstileWidget({ siteKey }: { siteKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const mount = () => {
      if (!active || !containerRef.current || !window.turnstile) return;
      if (widgetRef.current) {
        window.turnstile.remove(widgetRef.current);
        widgetRef.current = null;
      }
      containerRef.current.innerHTML = "";
      widgetRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "light",
        callback: () => setError(false),
        "error-callback": () => setError(true),
        "expired-callback": () => setError(false),
      });
      setReady(true);
    };

    const cleanup = loadScript(mount);
    return () => {
      active = false;
      cleanup();
      if (widgetRef.current && window.turnstile) {
        window.turnstile.remove(widgetRef.current);
        widgetRef.current = null;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    const reset = () => {
      if (widgetRef.current && window.turnstile) window.turnstile.reset(widgetRef.current);
    };
    window.addEventListener("turnstile:reset", reset);
    return () => window.removeEventListener("turnstile:reset", reset);
  }, []);

  return (
    <div className="space-y-1.5">
      <div ref={containerRef} className="min-h-[65px]" />
      {!ready ? (
        <p className="text-xs text-[#8A9A90]">Memuat verifikasi keamanan…</p>
      ) : error ? (
        <p className="text-xs text-[#B91C1C]">
          Verifikasi keamanan gagal dimuat. Muat ulang halaman lalu coba lagi.
        </p>
      ) : (
        <p className="text-xs text-[#8A9A90]">
          Dilindungi Cloudflare Turnstile. Tidak perlu memecahkan teka-teki.
        </p>
      )}
    </div>
  );
}
