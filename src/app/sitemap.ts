import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();
  const routes = [
    { path: "/", priority: 1, changeFrequency: "daily" as const },
    { path: "/pricing", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/fitur", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/status", priority: 0.6, changeFrequency: "hourly" as const },
    { path: "/faq", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/kontak", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/sla", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/syarat-ketentuan", priority: 0.4, changeFrequency: "yearly" as const },
    { path: "/kebijakan-privasi", priority: 0.4, changeFrequency: "yearly" as const },
    { path: "/kebijakan-refund", priority: 0.4, changeFrequency: "yearly" as const },
  ];
  return routes.map((route) => ({
    url: `${base}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
