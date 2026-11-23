"use client";

import { useActionState } from "react";
import { setupAction } from "./actions";

export function SetupForm() {
  const [state, action, pending] = useActionState(setupAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm text-crumb">Create the owner account. This page disappears once it&apos;s done.</p>
      <label><span className="field-label">Setup code</span>
        <input name="code" type="password" required className="input" autoComplete="off" /></label>
      <label><span className="field-label">Owner name</span>
        <input name="name" required className="input" defaultValue={state?.name ?? "Emmy"} maxLength={60} /></label>
      <label><span className="field-label">Owner email</span>
        <input name="email" type="email" required className="input" autoComplete="username" defaultValue={state?.email} /></label>
      <label><span className="field-label">Password (12+ characters)</span>
        <input name="password" type="password" minLength={12} required className="input" autoComplete="new-password" /></label>
      <label><span className="field-label">Confirm password</span>
        <input name="confirm" type="password" minLength={12} required className="input" autoComplete="new-password" /></label>
      {state?.error && <p role="alert" className="text-sm font-semibold text-berry">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Creating…" : "Create owner account"}</button>
    </form>
  );
}
