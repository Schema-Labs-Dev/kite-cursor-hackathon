import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://usekite.xyz/sitemap.xml",
    host: "https://usekite.xyz",
  };
}
