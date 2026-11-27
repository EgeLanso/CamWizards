import "server-only";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number
) => Promise<Buffer>;

function ticketSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Private chat signing is not configured.");
  return secret;
}

export function privateChatCookieName(chatId: string) {
  return "cw_private_chat_" + chatId.replace(/-/g, "");
}

export async function hashPrivateChatPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64);
  return salt.toString("base64url") + "." + derived.toString("base64url");
}

export async function verifyPrivateChatPassword(password: string, stored: string) {
  const [saltText, hashText] = stored.split(".");
  if (!saltText || !hashText) return false;
  try {
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(hashText, "base64url");
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = await scryptAsync(password, salt, 64);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createPrivateChatTicket(chatId: string, userId: string) {
  const payload = Buffer.from(JSON.stringify({
    chatId,
    userId,
    expiresAt: Date.now() + 6 * 60 * 60 * 1000
  })).toString("base64url");
  const signature = createHmac("sha256", ticketSecret()).update(payload).digest("base64url");
  return payload + "." + signature;
}

export function verifyPrivateChatTicket(
  token: string | undefined,
  chatId: string,
  userId: string
) {
  if (!token) return false;
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return false;
    const expected = createHmac("sha256", ticketSecret()).update(payload).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      chatId?: string;
      userId?: string;
      expiresAt?: number;
    };
    return decoded.chatId === chatId
      && decoded.userId === userId
      && typeof decoded.expiresAt === "number"
      && decoded.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export function privateChatCookieOptions(chatId: string) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/private-chats",
    maxAge: 6 * 60 * 60
  };
}
