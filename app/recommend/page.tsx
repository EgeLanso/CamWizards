import { createClient } from "@/lib/supabase/server";
import CameraFinder from "@/components/CameraFinder";

export default async function Recommend() {
  const supabase = await createClient();
  const [cameraResult, priceResult] = await Promise.all([
    supabase.from("cameras").select("id,name,brand,is_camcorder").order("name"),
    supabase.from("uploads").select("camera_id,camera_price,currency,condition")
      .not("camera_price", "is", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
  ]);

  const cameras = cameraResult.data || [];
  const grouped = new Map<string, { camera_id: string; currency: string; condition: string | null; lowest: number; count: number }>();
  for (const row of priceResult.data || []) {
    if (row.camera_price === null || !row.camera_id) continue;
    const currency = row.currency || "USD";
    const key = [row.camera_id, currency, row.condition || "unknown"].join("|");
    const price = Number(row.camera_price);
    if (!Number.isFinite(price)) continue;
    const existing = grouped.get(key);
    if (existing) {
      existing.lowest = Math.min(existing.lowest, price);
      existing.count += 1;
    } else {
      grouped.set(key, { camera_id: row.camera_id, currency, condition: row.condition, lowest: price, count: 1 });
    }
  }

  return <CameraFinder cameras={cameras} priceStats={Array.from(grouped.values())} />;
}