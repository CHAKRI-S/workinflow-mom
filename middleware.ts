import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

// ═══════════════════════════════════════════════════════
// Host detection
// ═══════════════════════════════════════════════════════

const LANDING_HOSTS = ["workinflow.cloud", "www.workinflow.cloud"];

type HostMode = "landing" | "mom" | "admin";

function detectHost(hostname: string): HostMode {
  if (hostname.startsWith("admin.")) return "admin";
  if (LANDING_HOSTS.includes(hostname)) return "landing";
  if (hostname.startsWith("mom.")) return "mom";
  // localhost / dev / IP / other — default to mom
  return "mom";
}

// ═══════════════════════════════════════════════════════
// Path configuration
// ═══════════════════════════════════════════════════════

// Paths on mom.* that don't require auth
const MOM_PUBLIC_PATHS = ["/login", "/api/auth", "/factory", "/signup", "/forgot-password", "/reset-password"];

function isMomPublicPath(pathname: string): boolean {
  const pathWithoutLocale = pathname.replace(/^\/(th|en)/, "") || "/";
  return MOM_PUBLIC_PATHS.some((p) => pathWithoutLocale.startsWith(p));
}

// Paths allowed on landing host (workinflow.cloud)
const LANDING_PATHS = ["/", "/signup", "/pricing", "/features", "/about", "/privacy", "/terms", "/faq", "/forgot-password"];

function isLandingPath(pathname: string): boolean {
  return LANDING_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// ═══════════════════════════════════════════════════════
// Middleware
// ═══════════════════════════════════════════════════════

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hostname = (req.headers.get("host") || "").split(":")[0];
  const mode = detectHost(hostname);

  // Skip Next internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // ─────────────────────────────────────────────────────
  // ADMIN HOST — admin.workinflow.cloud (Super Admin)
  // ─────────────────────────────────────────────────────
  if (mode === "admin") {
    // API routes: let them run but gate at the route-level (/api/sa/**)
    if (pathname.startsWith("/api")) {
      return NextResponse.next();
    }

    // Rewrite /* → /superadmin/*  (unless already /superadmin/*)
    const targetPath = pathname.startsWith("/superadmin")
      ? pathname
      : pathname === "/"
        ? "/superadmin"
        : `/superadmin${pathname}`;

    // Auth: require sa_token cookie, except on login page
    const saToken = req.cookies.get("sa_token")?.value;
    const isLoginPath = targetPath === "/superadmin/login";

    if (!saToken && !isLoginPath) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/superadmin/login";
      loginUrl.search = "";
      const res = NextResponse.redirect(loginUrl);
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }

    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = targetPath;
    const res = NextResponse.rewrite(rewriteUrl);
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  // ─────────────────────────────────────────────────────
  // LANDING HOST — workinflow.cloud
  // ─────────────────────────────────────────────────────
  if (mode === "landing") {
    // API routes pass through (public marketing APIs)
    if (pathname.startsWith("/api")) {
      return NextResponse.next();
    }

    // Allow landing paths to pass through (they resolve to (landing)/* route group)
    if (isLandingPath(pathname)) {
      return NextResponse.next();
    }

    // Anything else → redirect to mom.workinflow.cloud (user likely typed wrong domain)
    return NextResponse.redirect(
      new URL(`https://mom.workinflow.cloud${pathname}${req.nextUrl.search}`, req.url),
    );
  }

  // ─────────────────────────────────────────────────────
  // MOM HOST — mom.workinflow.cloud (tenant app)
  // ─────────────────────────────────────────────────────

  // API: handled server-side by route handlers
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Redirect marketing paths on mom.* → landing host
  const marketingPaths = ["/signup", "/pricing", "/features", "/about", "/faq"];
  if (marketingPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const isProd = process.env.NODE_ENV === "production";
    if (isProd) {
      return NextResponse.redirect(
        new URL(`https://workinflow.cloud${pathname}${req.nextUrl.search}`, req.url),
      );
    }
  }

  // Root path → redirect to default locale dashboard
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/th/dashboard", req.url));
  }

  // Run intl middleware
  const intlResponse = intlMiddleware(req);

  // Auth via session cookie (Edge-compatible — no prisma/bcrypt)
  if (!isMomPublicPath(pathname)) {
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

// Match everything except static assets & internal Next.js paths
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
