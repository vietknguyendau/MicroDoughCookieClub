import { ActionForm } from "@/components/action-form";
import { saveEventAction } from "../actions";
import { utcToZonedInput } from "@/lib/time";
import type { EventRow } from "@/lib/services/events";

type Flavor = { id: string; name: string; isActive: boolean };

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-crumb">{hint}</span>}
    </label>
  );
}

function defaults() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7 || 7)); // next Saturday
  const day = d.toISOString().slice(0, 10);
  const plus = (days: number) => {
    const x = new Date(`${day}T12:00:00Z`);
    x.setUTCDate(x.getUTCDate() + days);
    return x.toISOString().slice(0, 10);
  };
  return {
    startsAt: `${day}T11:00`,
    endsAt: `${day}T15:00`,
    entryOpensAt: `${day}T11:00`,
    entryClosesAt: `${plus(2)}T23:59`,
    drawingAt: `${plus(3)}T12:00`,
  };
}

export function EventForm({ ev, allFlavors, selected, locked }: { ev?: EventRow; allFlavors: Flavor[]; selected: string[]; locked: boolean }) {
  const d = defaults();
  const dt = (k: "startsAt" | "endsAt" | "entryOpensAt" | "entryClosesAt" | "drawingAt") => (ev ? utcToZonedInput(ev[k], ev.timezone) : d[k]);
  return (
    <ActionForm action={saveEventAction} className="flex flex-col gap-6">
      {ev && <input type="hidden" name="id" value={ev.id} />}

      <section className="box flex flex-col gap-4 p-5">
        <h2 className="hand-caps text-xl">The pop-up</h2>
        <Field label="Name">
          <input name="name" className="input" required defaultValue={ev?.name} placeholder="Holiday Market Pop-up" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location name">
            <input name="locationName" className="input" defaultValue={ev?.locationName} placeholder="Lu's Sandwiches" />
          </Field>
          <Field label="Address (optional)">
            <input name="locationAddress" className="input" defaultValue={ev?.locationAddress} />
          </Field>
          <Field label="Starts">
            <input type="datetime-local" name="startsAt" className="input" required defaultValue={dt("startsAt")} />
          </Field>
          <Field label="Ends">
            <input type="datetime-local" name="endsAt" className="input" required defaultValue={dt("endsAt")} />
          </Field>
        </div>
        <p className="text-xs text-crumb">All times are Central (America/Chicago).</p>
      </section>

      <section className="box flex flex-col gap-3 p-5">
        <h2 className="hand-caps text-xl">Cookies on the menu</h2>
        {allFlavors.length === 0 && <p className="text-sm text-crumb">Add flavors first under Flavors.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {allFlavors.map((f) => (
            <label key={f.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-beige bg-white px-3">
              <input
                type="checkbox"
                name="flavorIds"
                value={f.id}
                defaultChecked={ev ? selected.includes(f.id) : f.isActive}
                className="h-5 w-5 accent-ink"
              />
              <span className="font-semibold">{f.name}</span>
              {!f.isActive && <span className="label-caps ml-auto">inactive</span>}
            </label>
          ))}
        </div>
      </section>

      <section className="box flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="hand-caps text-xl">Giveaway</h2>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" name="giveawayEnabled" defaultChecked={ev?.giveawayEnabled ?? true} className="h-5 w-5 accent-ink" />
            Run a giveaway
          </label>
        </div>
        {locked && (
          <p className="rounded-xl bg-caramel/15 p-3 text-sm font-semibold text-caramel-dark">
            People have entered under the published rules, so the giveaway terms below are locked.
          </p>
        )}
        <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-2">
          <Field label="Entries open">
            <input type="datetime-local" name="entryOpensAt" className="input" required defaultValue={dt("entryOpensAt")} />
          </Field>
          <Field label="Entry deadline" hint="Leave a few days after the pop-up so people can enter remotely.">
            <input type="datetime-local" name="entryClosesAt" className="input" required defaultValue={dt("entryClosesAt")} />
          </Field>
          <Field label="Winner drawing date">
            <input type="datetime-local" name="drawingAt" className="input" required defaultValue={dt("drawingAt")} />
          </Field>
          <Field label="Winner response window (hours)">
            <input type="number" name="claimWindowHours" min={24} max={336} className="input" defaultValue={ev?.claimWindowHours ?? 48} />
          </Field>
          <Field label="Prize">
            <input name="prizeDescription" className="input" defaultValue={ev?.prizeDescription ?? "One free six-pack of Microdough cookies"} />
          </Field>
          <Field label="Approx. retail value ($)">
            <input type="number" step="0.01" min={0} name="prizeValue" className="input" defaultValue={((ev?.prizeValueCents ?? 2400) / 100).toFixed(2)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Eligibility">
              <textarea name="eligibility" className="input" defaultValue={ev?.eligibility ?? "Open to legal residents of Minnesota who are 18 years of age or older."} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Prize pickup / fulfillment">
              <textarea name="fulfillment" className="input" defaultValue={ev?.fulfillment ?? "Prize pickup will be arranged privately with Microdough in the Minneapolis area."} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Additional rules (optional)">
              <textarea name="additionalRules" className="input" defaultValue={ev?.additionalRules ?? ""} />
            </Field>
          </div>
        </fieldset>
        {locked && (
          <>
            {/* disabled fields aren't submitted; resend current values so nothing changes */}
            {(["entryOpensAt", "entryClosesAt", "drawingAt"] as const).map((k) => <input key={k} type="hidden" name={k} value={dt(k)} />)}
            <input type="hidden" name="claimWindowHours" value={ev!.claimWindowHours} />
            <input type="hidden" name="prizeDescription" value={ev!.prizeDescription} />
            <input type="hidden" name="prizeValue" value={(ev!.prizeValueCents / 100).toFixed(2)} />
            <input type="hidden" name="eligibility" value={ev!.eligibility} />
            <input type="hidden" name="fulfillment" value={ev!.fulfillment} />
            <input type="hidden" name="additionalRules" value={ev!.additionalRules} />
          </>
        )}
        {!locked && ev?.rulesApprovedAt && (
          <p className="text-xs text-crumb">Changing giveaway terms will un-publish the rules until you approve them again.</p>
        )}
      </section>

      <button className="btn btn-primary sticky bottom-3 w-full sm:static sm:w-auto sm:self-start">
        {ev ? "Save changes" : "Create pop-up"}
      </button>
    </ActionForm>
  );
}
