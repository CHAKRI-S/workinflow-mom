import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

// Pages that don't require authentication
const publicPaths = ["/login", "/api/auth"];

function isPublicPath(pathname: string): boolean {
  const pathWithoutLocale = pathname.replace(/^\/(th|en)/, "") || "/";
  return publicPaths.some((p) => pathWithoutLocale.startsWith(p));
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static files
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Skip API routes (auth handled server-side)
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Run intl middleware
  const intlResponse = intlMiddleware(req);

  // Check auth via session cookie (Edge-compatible — no prisma/bcrypt)
  if (!isPublicPath(pathname)) {
    const sessionToken =
      req.cookies.get("authjs.session-token")?.value ||
      req.cookies.get("__Secure-authjs.session-token")?.value;

    if (!sessionToken) {
      const locale = pathname.match(/^\/(th|en)/)?.[1] || "th";
      const loginUrl = new URL(`/${locale}/login`, req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlResponse;
}

export const config = {
  matcher: ["/", "/(th|en)/:path*"],
};
