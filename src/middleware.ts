import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast first gate: no session cookie → straight to login. The REAL check
 * (session exists + not expired) runs in requireAdmin() on every admin page,
 * server action and route handler — never rely on this alone.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "no-store");
    if (pathname !== "/admin/login" && !req.cookies.get("md_admin")) {
      if (pathname.startsWith("/api/")) return new NextResponse("Unauthorized", { status: 401 });
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }
  return res;
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
