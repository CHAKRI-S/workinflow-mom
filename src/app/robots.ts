import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const hdrs = await headers();
  const host = hdrs.get("host") || "";

  // Landing host → allow indexing
  if (host === "workinflow.cloud" || host === "www.workinflow.cloud") {
    return {
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://workinflow.cloud/sitemap.xml",
    };
  }

  // mom.* and admin.* → disallow everything (noindex)
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
