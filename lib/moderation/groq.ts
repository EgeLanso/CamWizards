import "server-only";

export type ReviewResult = {
  decision: "approve" | "hold" | "reject" | "ban";
  categories: string[];
  reason: string;
  confidence: number;
  originality: "likely_original" | "possible_edit" | "uncertain";
};

const MODEL = "qwen/qwen3.8-27b";

async function callGroq(messages: unknown[]): Promise<ReviewResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not configured.");
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0,
      max_completion_tokens: 260,
      response_format: { type: "json_object" },
      reasoning_effort: "none"
    }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Groq moderation unavailable (" + response.status + ").");
  const payload = await response.json();
  const raw = payload.choices?.[0]?.message?.content;
  if (typeof raw !== "string") throw new Error("Groq returned an empty moderation result.");
  const parsed = JSON.parse(raw);
  const allowed = ["approve", "hold", "reject", "ban"];
  return {
    decision: allowed.includes(parsed.decision) ? parsed.decision : "hold",
    categories: Array.isArray(parsed.categories) ? parsed.categories.slice(0, 8).map(String) : [],
    reason: String(parsed.reason || "Needs moderator review.").slice(0, 400),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    originality: "uncertain"
  };
}

const CHAT_POLICY = \`You are the moderation classifier for CamWizards, a photography community.
Allow ordinary profanity and casual swearing. Do NOT punish a message merely for words like fuck, shit, damn or similar ordinary swearing.
Reject threats, doxxing, targeted harassment, hateful slurs used as abuse, sexual harassment, spam and scams.
Distinguish abuse from neutral educational or reporting context; if context is unclear choose hold, not ban.
For chat: decision=ban only for high-confidence severe hate slurs, targeted harassment or credible threats. decision=reject for other disallowed content. decision=hold if uncertain.
Return ONLY JSON: {"decision":"approve|hold|reject|ban","categories":["..."],"reason":"short reason","confidence":0.0,"originality":"uncertain"}.\`;

const NAME_POLICY = \`You review only text metadata for a photography community.
Do not request, inspect, infer or moderate any photo, video, thumbnail, image URL or file content. Media files are not sent to this review.
Check only the post title, camera name and lens name for slurs, targeted harassment, sexual content, threats, spam, scams or clearly abusive names. Allow ordinary profanity in context. Do not reject a camera or lens name merely because it is unfamiliar or contains a brand/model number.
If uncertain, choose hold. Return ONLY JSON: {"decision":"approve|hold|reject","categories":["..."],"reason":"short reason","confidence":0.0,"originality":"uncertain"}.\`;

export async function moderateChat(body: string) {
  return callGroq([
    { role: "system", content: CHAT_POLICY },
    { role: "user", content: "Classify this chat message. Message: " + body.slice(0, 1000) }
  ]);
}

export async function moderateUpload(input: {
  title: string;
  camera: string;
  lens: string | null;
}) {
  return callGroq([
    { role: "system", content: NAME_POLICY },
    { role: "user", content:
      "Review these text fields only. Title: " + input.title.slice(0, 200) +
      ". Camera name: " + input.camera.slice(0, 120) +
      ". Lens name: " + (input.lens || "not provided").slice(0, 120) +
      ". No image or video is included or should be inspected."
    }
  ]);
}

export const GROQ_MODEL = MODEL;
