"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Home" },
  { href: "/admin/events", label: "Pop-ups" },
  { href: "/admin/giveaways", label: "Giveaways" },
  { href: "/admin/doughboard", label: "Doughboard" },
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/admin/flavors", label: "Flavors" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="mx-auto max-w-5xl overflow-x-auto px-2">
      <ul className="flex gap-1 py-2">
        {ITEMS.map((i) => {
          const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link prefetch={false}
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-10 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-bold ${
                  active ? "bg-ink text-cream" : "text-choc hover:bg-beige"
                }`}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
