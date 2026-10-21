"use client";

import { toast } from "sonner";
import type { ReactNode } from "react";

type ToastExtra = {
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
};

export function toastSuccess(title: string, extra?: ToastExtra) {
  return toast.success(title, {
    description: extra?.description,
    duration: extra?.duration ?? 4000,
    action: extra?.action
      ? { label: extra.action.label, onClick: extra.action.onClick }
      : undefined,
  });
}

export function toastError(title: string, extra?: ToastExtra) {
  return toast.error(title, {
    description: extra?.description,
    duration: extra?.duration ?? 5000,
    action: extra?.action
      ? { label: extra.action.label, onClick: extra.action.onClick }
      : undefined,
  });
}

export function toastWarning(title: string, extra?: ToastExtra) {
  return toast.warning(title, {
    description: extra?.description,
    duration: extra?.duration ?? 4500,
    action: extra?.action
      ? { label: extra.action.label, onClick: extra.action.onClick }
      : undefined,
  });
}

export function toastInfo(title: string, extra?: ToastExtra) {
  return toast.info(title, {
    description: extra?.description,
    duration: extra?.duration ?? 4000,
    action: extra?.action
      ? { label: extra.action.label, onClick: extra.action.onClick }
      : undefined,
  });
}

export function toastPromise<T>(
  promise: Promise<T>,
  messages: { loading: string; success: string | ((v: T) => string); error: string },
) {
  return toast.promise(promise, messages);
}

export function toastAction(title: string, description: ReactNode, label: string, onClick: () => void) {
  return toast(title, { description, action: { label, onClick }, duration: 6000 });
}
