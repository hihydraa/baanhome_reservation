import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
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

  const isHousekeeper = req.auth?.user?.role === "HOUSEKEEPER";
  const isAllowedForHousekeeper =
    req.nextUrl.pathname === "/" || req.nextUrl.pathname.startsWith("/dashboard");

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
