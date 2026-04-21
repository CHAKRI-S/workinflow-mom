import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // Ensure Thai font files used by server-side PDF rendering ship with
  // the standalone build (fs.readFileSync at runtime).
  outputFileTracingIncludes: {
    "/api/finance/invoices/[id]/pdf": ["./public/fonts/*.ttf"],
    "/api/finance/receipts/[id]/pdf": ["./public/fonts/*.ttf"],
    "/api/finance/tax-invoices/[id]/pdf": ["./public/fonts/*.ttf"],
  },
};

export default withNextIntl(nextConfig);
