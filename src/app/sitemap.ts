import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools/registry";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...TOOLS.map((tool) => ({
      url: `${SITE_URL}/tools/${tool.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
