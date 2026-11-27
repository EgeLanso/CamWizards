"use client";
import { useEffect, useState } from "react";

type Room = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  locked: boolean;
  unlocked: boolean;
  participants: string[];
};
type Message = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  username: string;
};

export default function PrivateChats() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [roomName, setRoomName] = useState("");
  const [usernames, setUsernames] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [unlockPassword, setUnlockPassword] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function loadRooms() {
    try {
      const response = await fetch("/api/private-chats", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load private rooms.");
      setRooms(result.rooms || []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load private rooms.");
    }
  }

  useEffect(() => {
    void loadRooms();
  }, []);

  useEffect(() => {
    if (!activeRoom || (activeRoom.locked && !activeRoom.unlocked)) return;
    let stopped = false;
    async function refresh() {
      try {
        const response = await fetch("/api/private-chats/" + activeRoom!.id + "/messages", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) {
          if (response.status === 403 && !stopped) {
            setActiveRoom(current => current?.id === activeRoom!.id ? { ...current, unlocked: false } : current);
          }
          return;
        }
        if (!stopped) setMessages(result.messages || []);
      } catch {
        if (!stopped) setNotice("Connection issue while loading messages.");
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 4000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [activeRoom?.id, activeRoom?.unlocked]);

  async function createRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const handles = usernames.split(",").map(value => value.trim().replace(/^@/, "")).filter(Boolean);
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/private-chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName, usernames: handles, password: newPassword })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create room.");
      setRoomName("");
      setUsernames("");
      setNewPassword("");
      setActiveRoom(result.room as Room);
      setMessages([]);
      await loadRooms();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create room.");
    } finally {
      setBusy(false);
    }
  }

  async function unlockRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRoom || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/private-chats/" + activeRoom.id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: unlockPassword })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not unlock room.");
      setActiveRoom({ ...activeRoom, unlocked: true });
      setUnlockPassword("");
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not unlock room.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRoom || !draft.trim() || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/private-chats/" + activeRoom.id + "/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: draft.trim() })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not send message.");
      setMessages(current => [...current.filter(item => item.id !== result.message.id), result.message].slice(-100));
      setDraft("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not send message.");
    } finally {
      setBusy(false);
    }
  }

  function leaveRoomList() {
    setActiveRoom(null);
    setMessages([]);
    setNotice("");
    void loadRooms();
  }

  return <section>
    <div className="section-head" style={{ marginTop: 44 }}>
      <div>
        <div className="eyebrow">Just your group</div>
        <h2>Private rooms</h2>
        <p className="muted">Create a group with selected CamWizards usernames. A room password is optional.</p>
      </div>
    </div>

    {!activeRoom ? <>
      <form className="panel" onSubmit={createRoom} style={{ display: "grid", gap: 10, marginBottom: 18 }}>
        <strong>Create a private room</strong>
        <input className="input" value={roomName} onChange={event => setRoomName(event.target.value)} maxLength={60} placeholder="Room name" aria-label="Room name" required />
        <input className="input" value={usernames} onChange={event => setUsernames(event.target.value)} placeholder="friend_one, friend_two" aria-label="Friend usernames separated by commas" required />
        <input className="input" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={6} maxLength={64} placeholder="Room password (optional, at least 6 characters)" aria-label="Optional room password" autoComplete="new-password" />
        <button className="btn primary" disabled={busy || !roomName.trim() || !usernames.trim()}>{busy ? "Creating..." : "Create private room"}</button>
      </form>

      <div className="grid" style={{ gap: 10 }}>
        {rooms.map(room => <button key={room.id} type="button" className="panel" onClick={() => { setActiveRoom(room); setMessages([]); setNotice(""); }} style={{ textAlign: "left", cursor: "pointer", color: "inherit" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <strong>{room.locked ? "🔒 " : ""}{room.name}</strong>
            <span className="pill">{room.locked ? "Password protected" : "Private"}</span>
          </div>
          <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>{room.participants.join(" · ")}</p>
        </button>)}
        {!rooms.length && <div className="empty">No private rooms yet. Create one and add friends by username.</div>}
      </div>
    </> : <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div><div className="eyebrow">Private room</div><h3 style={{ margin: "4px 0" }}>{activeRoom.name}</h3></div>
        <button className="btn" type="button" onClick={leaveRoomList}>Back to rooms</button>
      </div>

      {activeRoom.locked && !activeRoom.unlocked ? <form onSubmit={unlockRoom} style={{ display: "grid", gap: 10, maxWidth: 420, marginTop: 22 }}>
        <p className="muted">This room is password protected. Enter its password to read and send messages.</p>
        <input className="input" type="password" value={unlockPassword} onChange={event => setUnlockPassword(event.target.value)} placeholder="Room password" autoComplete="current-password" required />
        <button className="btn primary" disabled={busy || !unlockPassword}>{busy ? "Checking..." : "Unlock room"}</button>
      </form> : <>
        <p className="muted" style={{ fontSize: 12 }}>{activeRoom.participants.join(" · ")}</p>
        <div style={{ height: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 9, padding: "12px 0" }}>
          {messages.map(message => <div key={message.id} style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <strong style={{ fontSize: 12 }}>{message.username}</strong>
              <span className="muted" style={{ fontSize: 10 }}>{new Date(message.created_at).toLocaleTimeString()}</span>
            </div>
            <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{message.body}</p>
          </div>)}
          {!messages.length && <div className="empty">No messages yet. Start the conversation.</div>}
        </div>
        <form onSubmit={sendMessage} style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input className="input" value={draft} onChange={event => setDraft(event.target.value)} maxLength={1000} placeholder="Write a private message..." aria-label="Private message" disabled={busy} />
          <button className="btn primary" disabled={busy || !draft.trim()}>{busy ? "Sending..." : "Send"}</button>
        </form>
      </>}
    </div>}

    {notice && <p className="notice" aria-live="polite" style={{ marginTop: 12 }}>{notice}</p>}
    <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>Only invited members can access a room. Room passwords are stored as salted hashes, not readable text. Private rooms are separate from the public Lounge.</p>
  </section>;
}
