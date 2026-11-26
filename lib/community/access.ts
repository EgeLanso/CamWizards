import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getStaffContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null as string | null, isOwner: false, admin: null };
  const isOwner = Boolean(process.env.OWNER_EMAIL && user.email?.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase());
  let role: string | null = isOwner ? "owner" : null;
  if (!isOwner) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    role = data?.role || null;
  }
  let admin = null;
  if (role && process.env.SUPABASE_SERVICE_ROLE_KEY) admin = createAdminClient();
  return { user, role, isOwner, admin };
}

export async function getActiveBan(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("user_bans").select("id,reason,expires_at")
    .eq("user_id", userId).is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

export function canModerate(role: string | null) {
  return role === "owner" || role === "admin" || role === "moderator";
}