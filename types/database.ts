export type MediaType = "photo" | "video";
export type Condition = "new" | "used";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  xp: number;
};

export type Camera = {
  id: string;
  name: string;
  brand: string | null;
  is_camcorder: boolean;
  created_at: string;
};

export type Lens = {
  id: string;
  name: string;
  brand: string | null;
  created_at: string;
};

export type Upload = {
  id: string;
  user_id: string;
  media_type: MediaType;
  storage_path: string;
  title: string;
  description: string | null;
  camera_id: string;
  lens_id: string | null;
  camera_name: string;
  lens_name: string | null;
  camera_price: number | null;
  currency: string | null;
  purchased_from: string | null;
  condition: Condition | null;
  expires_at: string | null;
  created_at: string;
  moderation_status?: "pending" | "approved" | "rejected" | "needs_review";
  originality_status?: "unverified" | "likely_original" | "possible_edit" | "uncertain";
};

export const CATEGORIES = [
  "Street","Wildlife","Animals","Architecture","Landscape",
  "Astrophotography","Portrait","Cars","Night","Other"
] as const;