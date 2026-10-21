"use client";

import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageTransitionProvider } from "@/components/shared/page-transition";

export function Providers({
  brandName,
  children,
}: {
  brandName: string;
  children: React.ReactNode;
}) {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <PageTransitionProvider brandName={brandName}>
        {children}
        <Toaster
          position={mobile ? "top-center" : "top-right"}
          closeButton
          richColors={false}
          toastOptions={{ duration: 4000 }}
        />
      </PageTransitionProvider>
    </TooltipProvider>
  );
}
