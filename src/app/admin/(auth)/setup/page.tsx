import { notFound } from "next/navigation";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { Logo } from "@/components/brand";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "First-time setup", robots: { index: false } };

/**
 * One-time owner account creation, for deploying without a terminal.
 * Only works while NO admin exists AND the visitor knows ADMIN_SETUP_CODE.
 * Once the first account exists this page 404s forever.
 */
export default async function SetupPage() {
  const [{ n }] = await db.select({ n: count() }).from(adminUsers);
  if (Number(n) > 0) notFound();
  const configured = (process.env.ADMIN_SETUP_CODE ?? "").length >= 12;

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <Logo withTagline={false} className="mx-auto w-36" />
      <h1 className="hand-caps mt-6 text-center text-2xl">First-time setup</h1>
      <div className="box mt-6 p-5">
        {configured ? (
          <SetupForm />
        ) : (
          <p className="text-sm leading-relaxed">
            Setup is locked. In Vercel → Settings → Environment Variables, add <strong>ADMIN_SETUP_CODE</strong> (any
            secret phrase, 12+ characters), redeploy, then come back to this page.
          </p>
        )}
      </div>
    </div>
  );
}
