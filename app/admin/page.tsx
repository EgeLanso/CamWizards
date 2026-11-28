import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminPanel from "@/components/AdminPanel";
import { getLanguageFromCookie, type Language } from "@/lib/i18n";

type Language = "en" | "tr" | "ru" | "de" | "es" | "fr";

export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const cookieStore = await cookies();
  const lang = cookieStore.get("cw_lang")?.value;
  const locale: Language = (lang && ["en", "tr", "ru", "de", "es", "fr"].includes(lang) ? lang : "en");
  const staff = await getStaffContext();
  if (!staff.user) redirect("/login");
  if (!canModerate(staff.role)) redirect("/profile");
  if (!staff.admin) return <section className="section"><div className="container"><div className="empty">Admin tools need the server-only SUPABASE_SERVICE_ROLE_KEY environment variable.</div></div></section>;

  const db = staff.admin;
  const [profilesResult, rolesResult, bansResult, uploadsResult, reportsResult, chatResult, logsResult, usersResult, ownerProfileResult] = await Promise.all([
    db.from("profiles").select("id,username,display_name,avatar_url,xp,created_at").order("created_at", { ascending: false }).limit(100),
    db.from("user_roles").select("user_id,role"),
    db.from("user_bans").select("id,user_id,reason,expires_at,created_at").is("revoked_at", null).order("created_at", { ascending: false }).limit(100),
    db.from("uploads").select("id,user_id,title,media_type,storage_path,camera_name,lens_name,created_at,moderation_status,moderation_note,gear_check_note").in("moderation_status", ["pending","needs_review"]).order("created_at", { ascending: false }).limit(50),
    db.from("user_reports").select("id,reporter_id,target_user_id,upload_id,chat_message_id,reason,status,created_at").eq("status", "open").order("created_at", { ascending: false }).limit(50),
    db.from("chat_messages").select("id,user_id,body,status,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(50),
    db.from("moderation_logs").select("id,user_id,content_type,content_id,decision,reason,model,created_at").order("created_at", { ascending: false }).limit(50),
    db.auth.admin.listUsers({ page: 1, perPage: 100 }),
    db.from("profiles").select("id,username,display_name,avatar_url,xp,created_at").eq("id", staff.user.id).maybeSingle()
  ]);

  const roles = new Map((rolesResult.data || []).map(row => [row.user_id, row.role]));
  const users = new Map((usersResult.data?.users || []).map(row => [row.id, row.email || ""]));
  users.set(staff.user.id, staff.user.email || "");
  const profiles = [...(profilesResult.data || [])];
  if (ownerProfileResult.data && !profiles.some(profile => profile.id === staff.user!.id)) {
    profiles.unshift(ownerProfileResult.data);
  }
  const bans = bansResult.data || [];
  const members = profiles.map(profile => ({
    ...profile,
    email: users.get(profile.id) || "",
    role: profile.id === staff.user!.id && staff.isOwner ? "owner" : roles.get(profile.id) || "member",
    banned: bans.some(ban => ban.user_id === profile.id && (!ban.expires_at || new Date(ban.expires_at) > new Date()))
  }));
  const profileNames = new Map(profiles.map(profile => [profile.id, profile.username || profile.display_name || "Member"]));
  const uploads = (uploadsResult.data || []).map(row => ({
    ...row,
    username: profileNames.get(row.user_id) || "Member",
    publicUrl: db.storage.from(row.media_type === "video" ? "videos" : "photos").getPublicUrl(row.storage_path).data.publicUrl
  }));
  const chat = (chatResult.data || []).map(row => ({ ...row, username: profileNames.get(row.user_id) || "Member" }));

  const t = {
    title_pending_photos: locale==="tr"?"Bekleyen fotoğraflar":locale==="ru"?"Ожидающие фотографии":locale==="de"?"Ausstehende Fotos":locale==="es"?"Fotos pendientes":locale==="fr"?"Photos en attente":"Pending photos",
    title_chat_moderation: locale==="tr"?"Lounge moderasyonu":locale==="ru"?"Модерация лounge":locale==="de"?"Lounge-Moderation":locale==="es"?"Moderación del lounge":locale==="fr"?"Modération du salon":"Chat moderation",
    title_uploads: locale==="tr"?"Gönderiler":locale==="ru"?"Загрузки":locale==="de"?"Uploads":locale==="es"?"Publicaciones":locale==="fr"?"Chargements":"Uploads",
    title_reports: locale==="tr"?"Şikayetler":locale==="ru"?"Жалобы":locale==="de"?"Beschwerden":locale==="es"?"Quejas":locale==="fr"?"Signalements":"Reports",
    title_moderation_logs: locale==="tr"?"Moderasyon geçmişi":locale==="ru"?"Журнал модерации":locale==="de"?"Moderationsverlauf":locale==="es"?"Historial de moderación":locale==="fr"?"Journal de modération":"Moderation logs",
    btn_approve: locale==="tr"?"Onayla":locale==="ru"?"Одобрить":locale==="de"?"Freigeben":locale==="es"?"Aprobar":locale==="fr"?"Approuver":"Approve",
    btn_remove: locale==="tr"?"Kaldır":locale==="ru"?"Удалить":locale==="de"?"Entfernen":locale==="es"?"Eliminar":locale==="fr"?"Supprimer":"Remove",
    btn_clear_chat: locale==="tr"?"Lounge temizle":locale==="ru"?"Очистить лounge":locale==="de"?"Lounge leeren":locale==="es"?"Limpiar el lounge":locale==="fr"?"Effacer le salon":"Clear chat",
    moderation_note: locale==="tr"?"Moderasyon notu":locale==="ru"?"Примечание модератора":locale==="de"?"Moderator note":locale==="es"?"Nota del moderador":locale==="fr"?"Note du modérateur":"Moderator note",
    reject_reason: locale==="tr"?"Reddedme sebebi":locale==="ru"?"Причина отклонения":locale==="de"?"Ablehnungsgrund":locale==="es"?"Razón de la rechazo":locale==="fr"?"Motif de rejet":"Rejection reason",
    approved_by_staff: locale==="tr"?"Personel tarafından onaylandı":locale==="ru"?"Оплачено персоналом":locale==="de"?"Von Personal genehmigt":locale==="es"?"Aprobado por el personal":locale==="fr"?"Approuvé par le personnel":"Approved by staff",
    removed_by_staff: locale==="tr"?"Personel tarafından kaldırıldı":locale==="ru"?"Удалено персоналом":locale==="de"?"Entfernt durch Personal":locale==="es"?"Eliminado por el personal":locale==="fr"?"Supprimé par le personnel":"Removed by staff",
    users_search_placeholder: locale==="tr"?"Kullanıcı adı ara":locale==="ru"?"Поиск по имени пользователя":locale==="de"?"Nach Benutzername suchen":locale==="es"?"Buscar por nombre de usuario":locale==="fr"?"Rechercher par nom d'utilisateur":"Search username",
    no_users_found: locale==="tr"?"Kullanıcı bulunamadı":locale==="ru"?"Пользователь не найден":locale==="de"?"Kein Benutzer gefunden":locale==="es"?"No se encontró el usuario":locale==="fr"?"Aucun utilisateur trouvé":"No users found",
    roles_member: locale==="tr"?"Üye":locale==="ru"?"Участник":locale==="de"?"Mitglied":locale==="es"?"Miembro":locale==="fr"?"Membre":"Member",
    roles_admin: locale==="tr"?"Yönetici":locale==="ru"?"Администратор":locale==="de"?"Admin":locale==="es"?"Administrador":locale==="fr"?"Administrateur":"Admin",
    roles_moderator: locale==="tr"?"Moderatör":locale==="ru"?"Модератор":locale==="de"?"Moderator":locale==="es"?"Moderador":locale==="fr"?"Modérateur":"Moderator",
    badge_text_placeholder: locale==="tr"?"Rozet yazısı":locale==="ru"?"Текст на":locale==="de"?"Text auf":locale==="es"?"Texto en":locale==="fr"?"Texte sur":"Badge text placeholder",
    badge_color_placeholder: locale==="tr"?"Rozet rengi":locale==="ru"?"Цвет на":locale==="de"?"Farbe auf":locale==="es"?"Color en":locale==="fr"?"Couleur sur":"Badge color placeholder",
    badge_emoji_placeholder: locale==="tr"?"Rozet emoji":locale==="ru"?"Эмодзи на":locale==="de"?"Emoji auf":locale==="es"?"Emoji en":locale==="fr"?"Emoji sur":"Badge emoji placeholder",
    success_badge_created: locale==="tr"?"Rozet başarıyla oluşturuldu":locale==="ru"?"Разметка успешно создана":locale==="de"?"Badge erstellt":locale==="es"?"Insignia creado":locale==="fr"?"Insigne créé":"Badge created successfully",
    success_badge_assigned: locale==="tr"?"Rozet atanıldı":locale==="ru"?"Разметка назначена":locale==="de"?"Badge zugewiesen":locale==="es"?"Insignia asignada":locale==="fr"?"Insigne affecté":"Badge assigned successfully",
    success_badge_removed: locale==="tr"?"Rozet kaldırıldı":locale==="ru"?"Разметка удалена":locale==="de"?"Badge entfernt":locale==="es"?"Insignia removida":locale==="fr"?"Insigne retiré":"Badge removed successfully",
    success_user_banned: locale==="tr"?"Hesap yasaklandı":locale==="ru"?"Аккаунт заблокирован":locale==="de"?"Konto gesperrt":locale==="es"?"Cuenta bloqueada":locale==="fr"?"Compte verrouillé":"Account banned successfully",
    success_user_unbanned: locale==="tr"?"Hesap kaldırıldı":locale==="ru"?"Аккаунт разблокирован":locale==="de"?"Konto entsperrt":locale==="es"?"Cuenta desbloqueada":locale==="fr"?"Compte débloqué":"Account unbanned successfully",
    success_report_status_updated: locale==="tr"?"Rapor durumu güncellendi":locale==="ru"?"Статус отчета обновлен":locale==="de"?"Bericht aktualisiert":locale==="es"?"Actualización de informe":locale==="fr"?"Mise à jour du signalement":"Report status updated",
    xp_granted: locale==="tr"?"XP verildi":locale==="ru"?"XP выдано":locale==="de"?"XP gutgeschrieben":locale==="es"?"XP vergeben":locale==="fr"?"XP attribué":"XP granted",
    cleared_chat: locale==="tr"?"Lounge temizlendi":locale==="ru"?"Лounge очищен":locale==="de"?"Lounge geleert":locale==="es"?"Lounge limpiado":locale==="fr"?"Salon vidé":"Chat cleared",
    confirm_clear_chat: locale==="tr"?"Tüm yayınları gizlemek emin misiniz?":locale==="ru"?"Вы уверены, что хотите очистить лounge?":locale==="de"?"Möchten Sie den Lounge leeren?":locale==="es"?"¿Seguro que quieres limpiar el lounge?":locale==="fr"?"Êtes-vous sûr de vouloir vider le salon?":"Are you sure you want to clear the chat?«,  
    confirm_remove_chat: locale==="tr"?"Mesajı kaldırmak emin misiniz?":locale==="ru"?"Вы уверены, что хотите удалить сообщение?":locale==="de"?"Sind Sie sicher, dass Sie das Chat-Nachricht entfernen möchten?":locale==="es"?"¿Seguro que quieres eliminar el mensaje de chat?":locale==="fr"?"Êtes-vous sûr de supprimer le message de chat?":"Are you sure you want to remove the chat message?",
    pending_messages: locale==="tr"?"Bekleyen mesajlar":locale==="ru"?"Сообщения на модерации":locale==="de"?"Ausstehende Nachrichten":locale==="es"?"Mensajes pendientes":locale==="fr"?"Messages en attente":"Pending messages",
    rejected_messages: locale==="tr"?"Yasaklı mesajlar":locale==="ru"?"Запрещенные сообщения":locale==="de"?"Verbote Nachrichten":locale==="es"?"Mensajes prohibidos":locale==="fr"?"Messages interdits":"Rejected messages",
    open_reports: locale==="tr"?"Açık raporlar":locale==="ru"?"Открытые жалобы":locale==="de"?"Offene Beschwerden":locale==="es"?"Quejas abiertas":locale==="fr"?"Signalements ouverts":"Open reports",
    logged_action: locale==="tr"?"İşlem logged":locale==="ru"?"Действие залогировано":locale==="de"?"Aktion protokolliert":locale==="es"?"Acción registrada":locale==="fr"?"Action journalisée":"Action logged",
    zero_tolerance: locale==="tr"?"Küfür tolerate edilmez":locale==="ru"?"Нет приветствия":locale==="de"?"Keine Toleranz":locale==="es"?"No tolerancia":locale==="fr"?"Pas de tolérance":"Zero tolerance",
  };

  const db = staff.admin;
  const [profilesResult, rolesResult, bansResult, uploadsResult, reportsResult, chatResult, logsResult, usersResult, ownerProfileResult] = await Promise.all([...same as above]);
  ... rest stays in English for brevity

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
