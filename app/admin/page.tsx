import { redirect } from "next/navigation";
import { getStaffContext, canModerate } from "@/lib/community/access";
import AdminPanel from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const staff = await getStaffContext();
  if (!staff.user) redirect("/login");
  if (!canModerate(staff.role)) redirect("/profile");
  if (!staff.admin) return <section className="section"><div className="container"><div className="empty">Admin tools need the server-only SUPABASE_SERVICE_ROLE_KEY environment variable.</div></div></section>;

  const db = staff.admin;
  const [profilesResult, rolesResult, bansResult, uploadsResult, reportsResult, chatResult, logsResult, usersResult] = await Promise.all([
    db.from("profiles").select("id,username,display_name,avatar_url,xp,created_at").order("created_at", { ascending: false }).limit(100),
    db.from("user_roles").select("user_id,role"),
    db.from("user_bans").select("id,user_id,reason,expires_at,created_at").is("revoked_at", null).order("created_at", { ascending: false }).limit(100),
    db.from("uploads").select("id,user_id,title,media_type,storage_path,camera_name,lens_name,created_at,moderation_status,moderation_note,gear_check_note").in("moderation_status", ["pending","needs_review"]).order("created_at", { ascending: false }).limit(50),
    db.from("user_reports").select("id,reporter_id,target_user_id,upload_id,chat_message_id,reason,status,created_at").eq("status", "open").order("created_at", { ascending: false }).limit(50),
    db.from("chat_messages").select("id,user_id,body,status,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(50),
    db.from("moderation_logs").select("id,user_id,content_type,content_id,decision,reason,model,created_at").order("created_at", { ascending: false }).limit(50),
    db.auth.admin.listUsers({ page: 1, perPage: 100 })
  ]);

  const roles = new Map((rolesResult.data || []).map(row => [row.user_id, row.role]));
  const users = new Map((usersResult.data?.users || []).map(row => [row.id, row.email || ""]));
  const profiles = profilesResult.data || [];
  const bans = bansResult.data || [];
  const members = profiles.map(profile => ({
    ...profile,
    email: users.get(profile.id) || "",
    role: profile.id === staff.user!.id && staff.isOwner ? "owner" : roles.get(profile.id) || "member",
    banned: bans.some(ban => ban.user_id === profile.id && (!ban.expires_at || new Date(ban.expires_at) > new Date()))
  }));
  const profileNames = new Map(profiles.map(profile => [profile.id, profile.username || profile.display_name || "Member"]));
  const uploads = (uploadsResult.data || []).map(row => ({ ...row, username: profileNames.get(row.user_id) || "Member" }));
  const chat = (chatResult.data || []).map(row => ({ ...row, username: profileNames.get(row.user_id) || "Member" }));

  return <AdminPanel
    role={staff.role!}
    members={members}
    uploads={uploads}
    chat={chat}
    reports={reportsResult.data || []}
    logs={logsResult.data || []}
    profileNames={Object.fromEntries(profileNames)}
  />;
}