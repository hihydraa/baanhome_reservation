import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Only reads the session cookie — built from the DB-free config so the proxy bundle stays small.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  // Cron calls carry no session; the route checks its own bearer secret.
  if (req.nextUrl.pathname.startsWith("/api/cron/")) return NextResponse.next();

  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");
  const isApiRoute = req.nextUrl.pathname.startsWith("/api");

  if (!isLoggedIn && isApiRoute) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  // The internal auditor sees everything staff see but can never change anything.
  const isAuditor = req.auth?.user?.role === "AUDITOR";
  // Recording the outcome of an audit finding is the auditor's job; that route checks the role itself.
  const isAuditWrite = /^\/api\/audit-findings\/[^/]+$/.test(req.nextUrl.pathname);
  if (isLoggedIn && isAuditor && isApiRoute && !isAuditWrite && !["GET", "HEAD"].includes(req.method)) {
    return NextResponse.json({ error: "บัญชีตรวจสอบภายในดูข้อมูลได้อย่างเดียว" }, { status: 403 });
  }

  const isHousekeeper = req.auth?.user?.role === "HOUSEKEEPER";
  // Mutations housekeeping performs right from the daily grid card's popup.
  const housekeeperActionPatterns = [
    /^\/api\/resources\/[^/]+\/housekeeping-status$/,
    /^\/api\/housekeeping\/records(\/[^/]+)?$/,
    /^\/api\/accommodation-bookings\/[^/]+\/extend$/,
    /^\/api\/accommodation-bookings\/[^/]+\/addons$/,
  ];
  const isAllowedForHousekeeper =
    req.nextUrl.pathname === "/" ||
    req.nextUrl.pathname.startsWith("/dashboard") ||
    req.nextUrl.pathname === "/housekeeping" ||
    req.nextUrl.pathname === "/housekeeping-daily" ||
    housekeeperActionPatterns.some((re) => re.test(req.nextUrl.pathname));

  if (isLoggedIn && isHousekeeper && !isAllowedForHousekeeper) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|icon.png).*)"],
};
