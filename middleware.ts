import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { auth } from "@/lib/auth";

const intlMiddleware = createIntlMiddleware(routing);

// Pages that don't require authentication
const publicPaths = ["/login"];

function isPublicPath(pathname: string): boolean {
  // Remove locale prefix (e.g., /th/login → /login)
  const pathWithoutLocale = pathname.replace(/^\/(th|en)/, "") || "/";
  return publicPaths.some((p) => pathWithoutLocale.startsWith(p));
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip API routes and static files
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Run intl middleware first (handles locale redirect)
  const intlResponse = intlMiddleware(req);

  // Check auth for non-public pages
  if (!isPublicPath(pathname)) {
    const session = await auth();
    if (!session?.user) {
      // Detect locale from path or default to "th"
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
