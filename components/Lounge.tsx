"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Language = "en" | "tr" | "ru" | "de" | "es" | "fr";

type Message = { id:string; user_id:string; body:string; status:string; created_at:string; username:string };
export default function Lounge({ initialMessages, currentUserId, locale="en" }:{initialMessages:Message[];currentUserId:string;locale?:Language}) {
  const [messages,setMessages]=useState(initialMessages);
  const [body,setBody]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");

  const byLang = {
    en: { waiting: "Waiting for moderation", empty: "Be the first to start a photography conversation.", sending: "Sending...", send: "Send", noticeSentVisible: "Message sent. +1 XP", noticeSentReview: "Message sent for review.", noticeError: "Could not send message.", rules: "No profanity or offensive language in any language. Hate speech, targeted harassment and threats are not allowed. Messages are checked before appearing." },
    tr: { waiting: "Moderasyon bekleniyor", empty: "İlk fotoğrafçılık konuşmasını sen başlat.", sending: "Gönderiliyor...", send: "Gönder", noticeSentVisible: "Mesaj gönderildi. +1 XP", noticeSentReview: "Mesaj incelemeye gönderildi.", noticeError: "Mesaj gönderilemedi.", rules: "Her dilde küfür ve saldırgan dil yasaktır. Nefret söylemi, hedefli taciz ve tehditlere izin verilmez. Mesajlar görünmeden önce kontrol edilir." },
    ru: { waiting: "Ожидает модерации", empty: "Будьте первым, кто начнет разговор о фотографии.", sending: "Отправка...", send: "Отправить", noticeSentVisible: "Сообщение отправлено. +1 XP", noticeSentReview: "Сообщение отправлено на проверку.", noticeError: "Не удалось отправить сообщение.", rules: "Недопустимы ненормативная лексика и оскорбительный язык на любом языке. Рассказывание о ненависти, целенаправленное домогательство и угрозы запрещены. Сообщения проверяются перед появлением." },
    de: { waiting: "Wartet auf Moderation", empty: "Seien Sie der Erste, der ein Fotografie-Gespräch beginnt.", sending: "Wird gesendet...", send: "Senden", noticeSentVisible: "Nachricht gesendet. +1 XP", noticeSentReview: "Nachricht zur Überprüfung gesendet.", noticeError: "Nachricht konnte nicht gesendet werden.", rules: "Keine Schimpfwörter oder beleidigende Sprache in irgendeiner Sprache. Hassrede, gezielte Belästigung und Drohungen sind nicht erlaubt. Nachrichten werden vor dem Erscheinen überprüft." },
    es: { waiting: "Esperando moderación", empty: "Sé el primero en iniciar una conversación de fotografía.", sending: "Enviando...", send: "Enviar", noticeSentVisible: "Mensaje enviado. +1 XP", noticeSentReview: "Mensaje enviado para revisión.", noticeError: "No se pudo enviar el mensaje.", rules: "No se permiten groserías ni lenguaje ofensivo en ningún idioma. El discurso de odio, el acoso dirigido y las amenazas no están permitidos. Los mensajes se revisan antes de aparecer." },
    fr: { waiting: "En attente de modération", empty: "Soyez le premier à commencer une conversation sur la photographie.", sending: "Envoi...", send: "Envoyer", noticeSentVisible: "Message envoyé. +1 XP", noticeSentReview: "Message envoyé pour révision.", noticeError: "Impossible d'envoyer le message.", rules: "Aucune grossièreté ni langage offensant dans aucune langue. Les discours de haine, le harcèlement ciblé et les menaces ne sont pas autorisés. Les messages sont vérifiés avant d'apparaître." },
  };
  const T = byLang[locale] || byLang.en;

  useEffect(()=>{
    const supabase=createClient();
    const channel=supabase.channel("camwizards-lounge")
      .on("postgres_changes",{event:"*",schema:"public",table:"chat_messages"},async payload=>{
        const row=(payload.new||payload.old) as {id?:string;user_id?:string;body?:string;status?:string;created_at?:string};
        if(!row.id) return;
        if(payload.eventType==="DELETE"||row.status==="removed"){
          setMessages(current=>current.filter(item=>item.id!==row.id));
          return;
        }
        if(row.status!=="visible" && row.user_id!==currentUserId) return;
        const {data:profile}=await supabase.from("profiles").select("username,display_name").eq("id",row.user_id!).maybeSingle();
        setMessages(current=>{
          const next=current.filter(item=>item.id!==row.id);
          if(row.status==="visible"||row.user_id===currentUserId) next.push({...row as Message,username:profile?.username||profile?.display_name||"Member"});
          return next.sort((a,b)=>a.created_at.localeCompare(b.created_at)).slice(-80);
        });
      }).subscribe();
    return ()=>{supabase.removeChannel(channel);};
  },[currentUserId]);

  async function send(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const text=body.trim();
    if(!text||busy)return;
    setBusy(true);setNotice("");
    try{
      const response=await fetch("/api/lounge",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text,language:locale})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Could not send message.");
      setBody("");
      setNotice(result.message|| (result.status==="visible"?T.noticeSentVisible:T.noticeSentReview));
    }catch(error){setNotice(error instanceof Error?error.message:T.noticeError);}
    finally{setBusy(false);}
  }

  return <div className="panel">
    <div style={{height:460,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,paddingRight:5}}>
      {messages.map(message=><div key={message.id} style={{padding:"11px 13px",border:"1px solid var(--border)",borderRadius:12,background:message.user_id===currentUserId?"rgba(214,243,106,.06)":"#0d1116"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10}}><strong style={{fontSize:12}}>{message.username}{message.user_id===currentUserId?" · You":""}</strong><span className="muted" style={{fontSize:10}}>{new Date(message.created_at).toLocaleTimeString()}</span></div>
        <p style={{margin:"7px 0 0",whiteSpace:"pre-wrap"}}>{message.body}</p>
        {message.status==="pending"&&<span className="muted" style={{fontSize:10}}>{T.waiting}</span>}
      </div>)}
      {!messages.length&&<div className="empty">{T.empty}</div>}
    </div>
    <form onSubmit={send} style={{display:"flex",gap:8,marginTop:14}}>
      <input className="input" value={body} onChange={event=>setBody(event.target.value)} maxLength={1000} placeholder="Talk cameras, lenses and photography..." aria-label="Chat message" disabled={busy}/>
      <button className="btn primary" disabled={busy||!body.trim()}>{busy?T.sending:T.send}</button>
    </form>
    {notice&&<p className="muted" aria-live="polite" style={{fontSize:12}}>{notice}</p>}
    <p className="muted" style={{fontSize:11}}>{T.rules}</p>
  </div>;
}
