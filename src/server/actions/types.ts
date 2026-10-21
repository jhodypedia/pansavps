export type ActionResult<T = unknown> = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
  redirectTo?: string;
  /** Jangan tampilkan toast/alert ke pengguna untuk hasil aksi ini. */
  silent?: boolean;
};

export type FormState = ActionResult;
