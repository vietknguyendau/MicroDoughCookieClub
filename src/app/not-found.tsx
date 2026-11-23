import Link from "next/link";
import { Bunny } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <Bunny className="h-24 w-auto" />
      <h1 className="hand-caps mt-4 text-3xl">Crumbs!</h1>
      <p className="mt-2">We couldn&apos;t find that page. It may have been eaten.</p>
      <Link href="/" className="btn btn-primary mt-6">Go to the cookie club</Link>
    </div>
  );
}
