/**
 * Gemini, used for two narrow jobs in the negotiation:
 *   1. understand()  — turn messy speech/text (Hinglish, Devanagari, numbers as words) into a structured intent
 *   2. compose()     — phrase the reply naturally, in the customer's language, for screen and for speech
 * It never decides prices. The deal-desk engine does; compose() output is rejected if it
 * contains any percentage or rupee amount the engine didn't put in the draft.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const FALLBACKS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.5-flash"]; // measured: 2.5 flash ≈ 0.8s, 3.5 flash ≈ 5-7s
let preferred: string | null = null;

export function llmEnabled() {
  return !!process.env.GEMINI_API_KEY;
}

type Schema = { type: string; properties?: Record<string, Schema>; items?: Schema; enum?: string[]; nullable?: boolean; required?: string[]; description?: string };

export async function geminiJSON<T>(opts: { system: string; prompt: string; schema: Schema; timeoutMs?: number; temperature?: number; models?: string[] }): Promise<T | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const models = [...new Set([...(opts.models ?? []), preferred, process.env.GEMINI_MODEL, ...FALLBACKS].filter(Boolean) as string[])].slice(0, 3);
  for (const model of models) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 6000);
    try {
      const r = await fetch(`${BASE}/${model}:generateContent`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
          generationConfig: {
            temperature: opts.temperature ?? 0.4,
            responseMimeType: "application/json",
            responseSchema: opts.schema,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
      if (!r.ok) continue; // 429/503 → next model
      const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text) continue;
      if (!opts.models?.includes(model)) preferred = model;
      return JSON.parse(text) as T;
    } catch {
      /* timeout or bad JSON → next model */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/* ---------------- understand ---------------- */

export type Intent = {
  lang: "en" | "hi";
  discountPct: number | null; // fraction, 0.25 = 25%
  wantsDiscount: boolean;
  termMonths: number | null;
  agree: boolean;
  refuse: boolean;
  competitor: string | null;
  bug: boolean;
  price: boolean;
  question: string | null;
  sentiment: number;
};

const INTENT_SCHEMA: Schema = {
  type: "OBJECT",
  properties: {
    lang: { type: "STRING", enum: ["en", "hi"], description: "hi if the customer used any Hindi/Hinglish (Latin or Devanagari), else en" },
    discountPct: { type: "NUMBER", nullable: true, description: "discount the customer explicitly asked for, as a FRACTION (25% → 0.25). null if no number." },
    wantsDiscount: { type: "BOOLEAN", description: "customer is pushing for a lower price or discount" },
    termMonths: { type: "INTEGER", nullable: true, description: "contract length the customer mentioned, in months (2 saal → 24)" },
    agree: { type: "BOOLEAN", description: "customer accepts the current offer / says ok, send it, haan, theek hai, bhejo" },
    refuse: { type: "BOOLEAN", description: "customer rejects the current offer" },
    competitor: { type: "STRING", nullable: true, description: "competitor product named (e.g. Freshdesk, Zendesk), or 'competitor' if they only say they're switching" },
    bug: { type: "BOOLEAN", description: "complains about product problems, bugs, failures, exports" },
    price: { type: "BOOLEAN", description: "complains about price or budget" },
    question: { type: "STRING", nullable: true, description: "a direct question the customer asked that needs an answer, in English, else null" },
    sentiment: { type: "NUMBER", description: "-1 angry … 0 neutral … 1 happy" },
  },
  required: ["lang", "discountPct", "wantsDiscount", "termMonths", "agree", "refuse", "competitor", "bug", "price", "question", "sentiment"],
};

export async function understand(text: string, history: { who: string; text: string }[]) {
  return geminiJSON<Intent>({
    system:
      "You parse what a B2B SaaS customer just said during a contract-renewal negotiation with Helpdeck's renewal assistant. The text may be English, Hinglish in Latin script, or Hindi in Devanagari, and may come from speech recognition (numbers may be spelled out: 'pachees' = 25, 'baarah' = 12, 'do saal' = 2 years). Extract the intent of the LATEST message only; use the history just to resolve references like 'that' or 'the offer'. Set discountPct only if a number is stated in the latest message. 'theek hai', 'ok', 'bhej do', 'send it', 'deal' mean agree=true. Do not invent numbers.",
    prompt: `Recent conversation:\n${history
      .slice(-6)
      .map((m) => `${m.who}: ${m.text}`)
      .join("\n")}\n\nCustomer just said: """${text}"""`,
    schema: INTENT_SCHEMA,
    temperature: 0,
    timeoutMs: 3500,
    models: ["gemini-2.5-flash-lite", "gemini-2.5-flash"],
  });
}

/* ---------------- compose ---------------- */

const COMPOSE_SCHEMA: Schema = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING", description: "what Clutch says, for the screen transcript. Hinglish in LATIN script when lang=hi." },
    speech: { type: "STRING", description: "the same reply for text-to-speech. When lang=hi: Hindi words in Devanagari, English words in Latin, digits as digits. When lang=en: same as reply." },
  },
  required: ["reply", "speech"],
};

export async function compose(input: {
  lang: "en" | "hi";
  channel: "chat" | "voice";
  draft: string;
  customer: string;
  question: string | null;
  facts: Record<string, unknown>;
  history: { who: string; text: string }[];
}) {
  const out = await geminiJSON<{ reply: string; speech: string }>({
    system: [
      "You are Clutch, Helpdeck's AI renewal assistant, talking to a customer about renewing their subscription.",
      "Persona: warm, direct, confident, never pushy. You speak as a woman — in Hindi use feminine verb forms (sakti hoon, rahi hoon, karungi, dungi).",
      "You are given a DRAFT that contains the business decision (offers, refusals, approvals, next steps). Your job is ONLY to phrase it naturally.",
      "HARD RULES:",
      "- Keep every number, percentage, rupee amount and term from the draft exactly. Never add, change or round a price, discount, percentage or date.",
      "- Never offer anything not in the draft. Never promise discounts, refunds or features that are not in the draft.",
      "- Only call an offer final or best if the draft does.",
      "- If the customer asked a direct question, answer it in one short sentence using ONLY the provided facts; if the facts don't cover it, say you'll have the team confirm.",
      input.lang === "hi"
        ? "- Language: natural Hinglish (the way Indian professionals talk). reply in Latin script; speech uses Devanagari for Hindi words and Latin for English words."
        : "- Language: natural Indian English.",
      input.channel === "voice"
        ? "- This is a PHONE CALL: at most 2 short sentences, under 40 words, no lists, no markdown, no emoji. You MAY drop secondary details from the draft (hours saved, migration cost) to stay short, but NEVER drop an offer, a refusal, an approval request or a question the draft asks. Keep ₹ figures exactly as written in the draft."
        : "- This is a chat: at most 4 sentences, no markdown, no emoji.",
    ].join("\n"),
    prompt: [
      `Facts you may use: ${JSON.stringify(input.facts)}`,
      `Conversation so far:\n${input.history
        .slice(-8)
        .map((m) => `${m.who}: ${m.text}`)
        .join("\n")}`,
      `Customer just said: """${input.customer}"""`,
      input.question ? `Customer's direct question: ${input.question}` : "",
      `DRAFT (decision to convey, language=${input.lang}): """${input.draft}"""`,
      input.lang === "hi"
        ? "Write the reply in HINGLISH (Hindi + English mix, Latin script) — not pure English, because the customer is speaking Hinglish."
        : "Write the reply in English.",
      input.channel === "voice" ? "Keep it to 2 short sentences (max 40 words)." : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    schema: COMPOSE_SCHEMA,
    temperature: 0.5,
    timeoutMs: input.channel === "voice" ? 4500 : 6000,
  });
  if (!out?.reply) return null;
  return checkNumbers(`${input.draft} ${input.customer}`, out) ? out : null;
}

/** Guardrail on the wording layer: no percentage or rupee figure may appear that the engine didn't produce. */
function checkNumbers(draft: string, out: { reply: string; speech: string }) {
  const pct = (s: string) => new Set([...s.matchAll(/(\d+(?:\.\d+)?)\s*(?:%|percent|प्रतिशत)/gi)].map((m) => Number(m[1])));
  const rupees = (s: string) => new Set([...s.matchAll(/₹\s?([\d,]+(?:\.\d+)?)/g)].map((m) => m[1].replace(/,/g, "")));
  const dp = pct(draft);
  const dr = rupees(draft);
  for (const text of [out.reply, out.speech]) {
    for (const p of pct(text)) if (!dp.has(p)) return false;
    for (const r of rupees(text)) if (!dr.has(r)) return false;
  }
  return true;
}
