import Link from "next/link";
import type { Upload } from "@/types/database";

type MediaCardItem = Pick<Upload, "id" | "media_type" | "storage_path" | "title" | "camera_name" | "lens_name">;

export function MediaCard({ item, publicUrl, creator }: { item: MediaCardItem; publicUrl: string; creator?: string }) {
  return (
    <Link href={`/media/${item.id}`} className="card">
      {item.media_type === "video" ? (
        <video className="media" src={publicUrl} muted playsInline preload="none" aria-label={item.title} />
      ) : (
        <img className="media" src={publicUrl} alt={item.title} loading="lazy" decoding="async" />
      )}
      <div className="card-body">
        <h3>{item.title}</h3>
        <div className="meta" style={{marginTop:8}}>
          <span className="pill">{item.camera_name}</span>
          {item.lens_name && <span className="pill">{item.lens_name}</span>}
          {creator && <span>by {creator}</span>}
        </div>
      </div>
    </Link>
  );
}