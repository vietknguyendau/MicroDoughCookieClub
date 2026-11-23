import { eq } from "drizzle-orm";
import { db } from "@/db";
import { flavorImages } from "@/db/schema";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const [img] = await db.select().from(flavorImages).where(eq(flavorImages.flavorId, id)).limit(1);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.mimeType,
      // URL includes ?v=<version>, so a new upload gets a new URL
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
