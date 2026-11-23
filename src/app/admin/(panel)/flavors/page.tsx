import { ActionForm } from "@/components/action-form";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { flavors } from "@/db/schema";
import { Badge, Empty, Notice, PageHeader, type SP } from "@/components/admin-ui";
import { CookieImage } from "@/components/brand";
import { deleteFlavorAction, moveFlavorAction, saveFlavorAction } from "../actions";
import { PhotoUpload } from "./photo-upload";

export default async function FlavorsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const rows = await db.select().from(flavors).orderBy(asc(flavors.sortOrder), asc(flavors.name));

  return (
    <>
      <PageHeader title="Flavors" />
      <Notice notice={sp.notice} error={sp.error} />

      <details className="box mb-5 p-5">
        <summary className="cursor-pointer font-extrabold text-ink">+ Add a new flavor</summary>
        <ActionForm action={saveFlavorAction} className="mt-4 flex flex-col gap-3">
          <label><span className="field-label">Name</span><input name="name" required className="input" maxLength={60} /></label>
          <label><span className="field-label">Description</span><textarea name="description" className="input" maxLength={400} /></label>
          <button className="btn btn-primary btn-sm self-start">Add flavor</button>
          <p className="text-xs text-crumb">You can add the photo right after.</p>
        </ActionForm>
      </details>

      {rows.length === 0 ? (
        <Empty title="No flavors yet">Run the seed script or add one above.</Empty>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((f, i) => (
            <li key={f.id} className={`box p-4 ${f.isActive ? "" : "opacity-70"}`}>
              <div className="flex gap-4">
                <div className="flex w-24 shrink-0 flex-col items-center gap-2">
                  <CookieImage flavorId={f.id} version={f.imageVersion} name={f.name} size={120} className="w-24" />
                  <PhotoUpload flavorId={f.id} hasPhoto={f.imageVersion > 0} />
                </div>
                <ActionForm action={saveFlavorAction} className="flex min-w-0 flex-1 flex-col gap-2">
                  <input type="hidden" name="id" value={f.id} />
                  <div className="flex items-center gap-2">
                    <input name="name" defaultValue={f.name} required maxLength={60} className="input !min-h-10 font-bold" aria-label="Flavor name" />
                    {!f.isActive && <Badge>Inactive</Badge>}
                  </div>
                  <textarea name="description" defaultValue={f.description} maxLength={400} className="input !min-h-20 text-sm" aria-label="Description" />
                  <label className="flex items-center gap-2 text-sm font-bold">
                    <input type="checkbox" name="isActive" defaultChecked={f.isActive} className="h-5 w-5 accent-ink" /> Active (shows up for new pop-ups)
                  </label>
                  <button className="btn btn-primary btn-sm self-start">Save</button>
                </ActionForm>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-beige pt-3">
                <span className="label-caps mr-auto">Order</span>
                <ActionForm action={moveFlavorAction}>
                  <input type="hidden" name="id" value={f.id} /><input type="hidden" name="dir" value="up" />
                  <button className="btn btn-secondary btn-sm" disabled={i === 0} aria-label={`Move ${f.name} up`}>↑</button>
                </ActionForm>
                <ActionForm action={moveFlavorAction}>
                  <input type="hidden" name="id" value={f.id} /><input type="hidden" name="dir" value="down" />
                  <button className="btn btn-secondary btn-sm" disabled={i === rows.length - 1} aria-label={`Move ${f.name} down`}>↓</button>
                </ActionForm>
                <ActionForm action={deleteFlavorAction}>
                  <input type="hidden" name="id" value={f.id} />
                  <button className="btn-quiet text-sm">Delete</button>
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-crumb">Flavors with ratings can&apos;t be deleted (it would erase history) — mark them inactive instead.</p>
    </>
  );
}
