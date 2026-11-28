import Link from "next/link";
import type { Upload } from "@/types/database";

type MediaCardItem = Pick<Upload, "id" | "media_type" | "storage_path" | "title" | "camera_name" | "lens_name">;

export function MediaCard({ item, publicUrl, creator, likeCount=0, creatorRank, locale="en" }: { item: MediaCardItem; publicUrl: string; creator?: string; likeCount?: number; creatorRank?: number; locale?: string }) {
  const boost = creatorRank && creatorRank <= 25 ? (creatorRank===1?60:creatorRank<=3?45:creatorRank<=10?30:15) : 0;
  const by = { en: "by", tr: "tarafından", ru: "от", de: "von", es: "por", fr: "par" }[locale] || "by";
  const rankLabel = { en: "Rank", tr: "Sıra", ru: "Ранг", de: "Rang", es: "Rango", fr: "Rang" }[locale] || "Rank";
  return <Link href={"/media/"+item.id} className="card">
    {item.media_type === "video" ? <video className="media" src={publicUrl} muted playsInline preload="none" aria-label={item.title}/> : <img className="media" src={publicUrl} alt={item.title} loading="lazy" decoding="async"/>}
    <div className="card-body"><h3>{item.title}</h3><div className="meta" style={{marginTop:8}}>
      <span className="pill">{item.camera_name}</span>{item.lens_name&&<span className="pill">{item.lens_name}</span>}
      {creator&&<span>{by} {creator}</span>}<span className="pill">♥ {likeCount}</span>{boost>0&&<span className="pill">#{creatorRank} {rankLabel} +{boost}</span>}
    </div></div>
  </Link>;
}
