import "server-only";

export type ReviewResult = {
  decision: "approve" | "hold" | "reject" | "ban";
  categories: string[];
  reason: string;
  confidence: number;
  originality: "likely_original" | "possible_edit" | "uncertain";
};

const MODEL = "qwen/qwen3-8b-27b";

async function callGroq(messages: unknown[]): Promise<ReviewResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not configured.");
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
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
  if (!response.ok) throw new Error(`Groq moderation unavailable (${response.status}).`);
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
    originality: ["likely_original", "possible_edit", "uncertain"].includes(parsed.originality) ? parsed.originality : "uncertain"
  };
}

const CHAT_POLICY = `You are the moderation classifier for CamWizards, a photography community.
NO profanity, swearing, or offensive language is allowed in ANY language (Turkish, English, Russian, German, Spanish, French, etc.).
Reject any message containing profanity, obscenity, insults, or offensive slang.
Reject attempts to hide profanity by separating letters, using numbers, dots, or similar character tricks.
Reject sexual content, nudity, graphic violence, self-harm promotion, threats, doxxing, spam, hateful symbols, and discriminatory abuse.
Racial slurs including the N-word used as abuse are severe hate speech. Targeted harassment, sexual harassment, or credible threats are severe.
Distinguish abuse from neutral educational or reporting context; if context is unclear choose hold, not ban.
For chat: decision=ban only for high-confidence severe hate slurs, targeted harassment or credible threats. decision=reject for other disallowed content including profanity. decision=hold if uncertain.
For photos: reject disallowed harmful imagery; hold uncertain cases. Never infer that a photo is authentic from appearance alone.
Return ONLY JSON: {"decision":"approve|hold|reject|ban","categories":["..."],"reason":"short reason","confidence":0.0,"originality":"likely_original|possible_edit|uncertain"}.`;

export async function moderateChat(body: string, language: string = "tr") {
  return callGroq([{ role: "system", content: CHAT_POLICY }, { role: "user", content: `Classify this chat message. Language hint: ${language}. Message: ${body.slice(0, 1000)}` }]);
}

export async function moderateUpload(input: {
  title: string; description: string; camera: string; lens: string | null;
  price: number | null; currency: string | null; imageUrls: string[];
}) {
  const content: Array<Record<string, unknown>> = [{
    type: "text",
    text: `Review this photography post title and metadata for safety and policy violations. Title: ${input.title}. Camera claimed: ${input.camera}. Lens claimed: ${input.lens || "not provided"}. Price: ${input.price ?? "not provided"} ${input.currency || ""}. NO profanity or offensive language is allowed in any language. Reject attempts to hide profanity by separating letters or using symbols. Check only for obvious policy violations in text. Return the required JSON. For originality, use likely_original unless obvious synthetic indicators; otherwise use uncertain.`
  }];
  return callGroq([{ role: "system", content: CHAT_POLICY }, { role: "user", content }]);
}

export const GROQ_MODEL = MODEL;

// Optional, short market check. Runs only when a member supplied a price.
export async function searchGearPrice(input: {
  camera: string; lens: string | null; price: number; currency: string | null; condition: string | null;
}) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not configured.");
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      messages: [{
        role: "user",
        content: `Do a very short web search to sanity-check this user-submitted camera gear price. Camera: ${input.camera}. Lens: ${input.lens || "not specified"}. Claimed price: ${input.price} ${input.currency || ""}. Condition: ${input.condition || "unknown"}. Search only for this exact gear and currency. Use at most 3 useful sources, prefer manufacturers and reputable retailers/marketplaces, distinguish new from used, and report a rough observed range rather than a precise valuation. Output at most 4 short lines: estimated range, whether the claimed price looks unusual, and source names/URLs. If sources are weak or currencies differ, say unable to verify. This is a moderation hint, not a final verdict.`
      }],
      temperature: 0,
      max_completion_tokens: 420,
      reasoning_effort: "low",
      tool_choice: "required",
      tools: [{ type: "browser_search" }]
    }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Groq gear search unavailable (${response.status}).`);
  const payload = await response.json();
  const result = payload.choices?.[0]?.message?.content;
  if (typeof result !== "string" || !result.trim()) throw new Error("No gear-search result.");
  return result.trim().slice(0, 1800);
}
