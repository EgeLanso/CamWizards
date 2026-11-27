import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const siteUrl = "https://cam-wizards.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const base: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/explore`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/cameras`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/lenses`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/recommend`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/leaderboard`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
  ];

  try {
    const supabase = await createClient();
    const [uploads, cameras, lenses, profiles] = await Promise.all([
      supabase.from("uploads").select("id,created_at,expires_at").eq("media_type", "photo").or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`).order("created_at", { ascending: false }).limit(1000),
      supabase.from("cameras").select("id,created_at").limit(1000),
      supabase.from("lenses").select("id,created_at").limit(1000),
      supabase.from("profiles").select("id,created_at").limit(1000),
    ]);

    return [
      ...base,
      ...(uploads.data || []).map((item) => ({
        url: `${siteUrl}/media/${item.id}`,
        lastModified: item.created_at ? new Date(item.created_at) : now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
      ...(cameras.data || []).map((item) => ({
        url: `${siteUrl}/cameras/${item.id}`,
        lastModified: item.created_at ? new Date(item.created_at) : now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...(lenses.data || []).map((item) => ({
        url: `${siteUrl}/lenses/${item.id}`,
        lastModified: item.created_at ? new Date(item.created_at) : now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...(profiles.data || []).map((item) => ({
        url: `${siteUrl}/profile/${item.id}`,
        lastModified: item.created_at ? new Date(item.created_at) : now,
        changeFrequency: "monthly" as const,
        priority: 0.4,
      })),
    ];
  } catch {
    return base;
  }
}
