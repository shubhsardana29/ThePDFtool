import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides/content";
import { TOOLS } from "@/lib/tools/registry";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1, lastModified: now },
    {
      url: `${SITE_URL}/guides`,
      changeFrequency: "weekly",
      priority: 0.7,
      lastModified: now,
    },
    ...TOOLS.map((tool) => ({
      url: `${SITE_URL}/tools/${tool.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
      lastModified: now,
    })),
    ...GUIDES.map((guide) => ({
      url: `${SITE_URL}/guides/${guide.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
      lastModified: new Date(guide.updated),
    })),
  ];
}
