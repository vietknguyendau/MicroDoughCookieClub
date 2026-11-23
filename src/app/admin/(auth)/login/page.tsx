import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { getAdmin } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Owner login", robots: { index: false } };

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <Logo withTagline={false} className="mx-auto w-36" />
      <h1 className="hand-caps mt-6 text-center text-2xl">Owner login</h1>
      <div className="box mt-6 p-5">
        <LoginForm />
      </div>
    </div>
  );
}
