import { ActionForm } from "@/components/action-form";
import { Notice, PageHeader, type SP } from "@/components/admin-ui";
import { loadSettings } from "@/lib/queries";
import { changePasswordAction, deletePersonAction, logoutAction, purgeExpiredAction, saveSettingsAction } from "../actions";

export default async function SettingsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const s = await loadSettings();
  return (
    <>
      <PageHeader title="Settings" />
      <Notice notice={sp.notice} error={sp.error} />

      <ActionForm action={saveSettingsAction} className="box mb-5 flex flex-col gap-4 p-5">
        <h2 className="hand-caps text-xl">Business info</h2>
        <label><span className="field-label">Sponsor name (for official rules)</span>
          <input name="sponsorName" defaultValue={s.sponsorName} required className="input" placeholder="Jane Doe d/b/a Microdough" /></label>
        <label><span className="field-label">Sponsor contact</span>
          <input name="sponsorContact" defaultValue={s.sponsorContact} className="input" placeholder="hello@microdough.com, Minneapolis, MN" /></label>
        <label><span className="field-label">Next pop-up note (shown to customers)</span>
          <textarea name="nextPopupNote" defaultValue={s.nextPopupNote} maxLength={300} className="input" placeholder="Sat, Dec 13 · 11–3 · Lu's Sandwiches" /></label>
        <label><span className="field-label">Delete giveaway contact info after (days)</span>
          <input type="number" name="retentionDays" min={30} max={1095} defaultValue={s.retentionDays} className="input" /></label>
        <button className="btn btn-primary btn-sm self-start">Save settings</button>
      </ActionForm>

      <section className="box mb-5 flex flex-col gap-3 p-5">
        <h2 className="hand-caps text-xl">Privacy tools</h2>
        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/export/optins" className="btn btn-secondary btn-sm">Export marketing opt-ins (CSV)</a>
          <ActionForm action={purgeExpiredAction}><button className="btn btn-secondary btn-sm">Run data cleanup now</button></ActionForm>
        </div>
        <p className="text-xs text-crumb">
          Cleanup deletes giveaway contact info older than {s.retentionDays} days after each giveaway closed (anonymous
          feedback is kept). Run it once a month or so.
        </p>
        <ActionForm action={deletePersonAction} className="mt-2 flex flex-col gap-3 rounded-xl border border-beige bg-white p-4">
          <p className="font-bold">Delete a person&apos;s data on request</p>
          <input name="email" type="email" required placeholder="their@email.com" className="input" />
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" className="mt-0.5 h-5 w-5 accent-ink" /> Permanently delete every giveaway entry for this email.</label>
          <button className="btn btn-danger btn-sm self-start">Delete their data</button>
        </ActionForm>
      </section>

      <ActionForm action={changePasswordAction} className="box mb-5 flex flex-col gap-3 p-5">
        <h2 className="hand-caps text-xl">Change password</h2>
        <input type="text" name="username" autoComplete="username" className="hidden" aria-hidden tabIndex={-1} />
        <label><span className="field-label">Current password</span><input type="password" name="current" autoComplete="current-password" required className="input" /></label>
        <label><span className="field-label">New password (12+ characters)</span><input type="password" name="next" minLength={12} autoComplete="new-password" required className="input" /></label>
        <button className="btn btn-primary btn-sm self-start">Change password</button>
        <p className="text-xs text-crumb">You&apos;ll be signed out on all devices.</p>
      </ActionForm>

      <ActionForm action={logoutAction} className="box flex flex-col gap-3 p-5">
        <h2 className="hand-caps text-xl">Sessions</h2>
        <input type="hidden" name="everywhere" value="on" />
        <button className="btn btn-secondary btn-sm self-start">Log out on all devices</button>
      </ActionForm>
    </>
  );
}
