import { ActionForm } from "@/components/action-form";
import { Logo } from "@/components/brand";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./nav";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Owner dashboard", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="no-print sticky top-0 z-20 border-b border-beige bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-3">
          <a href="/admin" className="flex items-center gap-2">
            <Logo withTagline={false} className="h-9 w-auto" />
            <span className="label-caps hidden sm:inline">Cookie Club HQ</span>
          </a>
          <ActionForm action={logoutAction} className="flex items-center gap-2 text-sm">
            <span className="hidden text-crumb sm:inline">Hi, {admin.name}</span>
            <button className="btn-quiet !min-h-0 !p-1">Log out</button>
          </ActionForm>
        </div>
        <AdminNav />
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-5">{children}</main>
    </div>
  );
}
