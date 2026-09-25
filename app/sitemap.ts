import type { MetadataRoute } from "next";

/**
 * Phase 9 SEO baseline: sitemap for every public route. Auth/dashboard/seller/
 * admin surfaces are excluded — they require sign-in and shouldn't be indexed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://driplnk.in";

  const routes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "", priority: 1, changeFrequency: "weekly" },
    { path: "/models", priority: 0.9, changeFrequency: "daily" },
    { path: "/mart", priority: 0.9, changeFrequency: "weekly" },
    { path: "/freelance", priority: 0.9, changeFrequency: "daily" },
    { path: "/leaff-os", priority: 0.8, changeFrequency: "weekly" },
    { path: "/app", priority: 0.7, changeFrequency: "weekly" },
    { path: "/download", priority: 0.8, changeFrequency: "weekly" },
    { path: "/partner", priority: 0.7, changeFrequency: "monthly" },
    { path: "/about", priority: 0.6, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
    { path: "/freelance/apply", priority: 0.5, changeFrequency: "monthly" },
    { path: "/vendor/apply", priority: 0.5, changeFrequency: "monthly" },
    // Legal pages — indexable once the draft banner is removed post-review.
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/refund-policy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/cookies", priority: 0.2, changeFrequency: "yearly" },
  ];

  return routes.map((route) => ({
    url: `${base}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
