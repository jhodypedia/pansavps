/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Server } from "lucide-react";

type TransitionContextValue = {
  navigate: (href: string) => void;
  isTransitioning: boolean;
};

const TransitionContext = createContext<TransitionContextValue | null>(null);

export function usePageTransition() {
  const ctx = useContext(TransitionContext);
  if (!ctx) {
    return { navigate: (href: string) => (window.location.href = href), isTransitioning: false };
  }
  return ctx;
}

const EASE = [0.32, 0.72, 0, 1] as const;

export function PageTransitionProvider({
  brandName,
  children,
}: {
  brandName: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(false);
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPath = useRef(pathname);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const navigate = useCallback(
    (href: string) => {
      if (reduced) {
        router.push(href);
        return;
      }
      pending.current = true;
      setVisible(true);
      setProgress(true);
      clearTimer();
      timer.current = setTimeout(() => {
        router.push(href);
      }, 280);
    },
    [reduced, router],
  );

  // Reveal overlay setelah pathname berubah.
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const wasPending = pending.current;
    pending.current = false;
    if (!reduced) {
      setVisible(true);
      setProgress(true);
    }
    clearTimer();
    timer.current = setTimeout(
      () => {
        setVisible(false);
        setProgress(false);
      },
      wasPending ? 320 : 300,
    );
    return clearTimer;
  }, [pathname, reduced]);

  // Intersep semua klik link internal (kecuali navigasi tab/query di halaman sama).
  useEffect(() => {
    if (reduced) return;
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.dataset.noTransition === "true") return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (href.startsWith("http") && !href.startsWith(window.location.origin)) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return; // tab/query/filter: tanpa overlay
      if (url.pathname === pathname) return;
      event.preventDefault();
      navigate(`${url.pathname}${url.search}${url.hash}`);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [navigate, pathname, reduced]);

  // Back/forward: tampilkan overlay singkat saat URL berubah.
  useEffect(() => {
    if (reduced) return;
    function onPop() {
      setVisible(true);
      setProgress(true);
      clearTimer();
      timer.current = setTimeout(() => {
        setVisible(false);
        setProgress(false);
      }, 480);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [reduced]);

  useEffect(() => () => clearTimer(), []);

  return (
    <TransitionContext.Provider value={{ navigate, isTransitioning: visible }}>
      {progress ? (
        <div className="fixed inset-x-0 top-0 z-[10001] h-[3px] bg-[#DCF0E3]">
          <div className="top-progress-bar h-full bg-[#16A34A]" />
        </div>
      ) : null}
      <AnimatePresence>
        {visible ? (
          <motion.div
            key="page-transition"
            className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#0B3D2E]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ duration: 0.28, ease: EASE }}
            aria-hidden="true"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.22, delay: 0.05 }}
              className="flex items-center gap-3 text-white"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-[#0E4D38] ring-1 ring-white/15">
                <Server className="size-6" />
              </span>
              <span className="font-display text-2xl font-bold tracking-tight">{brandName}</span>
            </motion.div>
            <div className="absolute inset-x-0 top-0 h-[3px] bg-white/10">
              <div className="top-progress-bar h-full bg-[#16A34A]" />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {children}
    </TransitionContext.Provider>
  );
}
