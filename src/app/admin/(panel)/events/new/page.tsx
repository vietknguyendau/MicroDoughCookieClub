import { asc } from "drizzle-orm";
import { db } from "@/db";
import { flavors } from "@/db/schema";
import { Notice, PageHeader, type SP } from "@/components/admin-ui";
import { EventForm } from "../event-form";

export default async function NewEventPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const all = await db.select({ id: flavors.id, name: flavors.name, isActive: flavors.isActive }).from(flavors).orderBy(asc(flavors.sortOrder));
  return (
    <>
      <PageHeader title="New pop-up" back="/admin/events" />
      <Notice error={sp.error} />
      <EventForm allFlavors={all} selected={[]} locked={false} />
    </>
  );
}
