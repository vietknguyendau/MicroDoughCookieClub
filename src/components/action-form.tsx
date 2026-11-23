"use client";

import { useActionState, useEffect } from "react";

type Result = { to?: string } | null;

/**
 * Form wrapper for admin server actions. When an action finishes it returns
 * where to go next; we do a full page load there, so the screen always shows
 * fresh data (and the notice) — no stale client-router state.
 */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: Result, form: FormData) => Promise<Result>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  useEffect(() => {
    if (state?.to) window.location.assign(state.to);
  }, [state]);
  return (
    <form action={formAction} className={className} aria-busy={pending || !!state?.to}>
      <fieldset disabled={pending || !!state?.to} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
