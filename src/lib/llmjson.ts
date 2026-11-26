/**
 * One structured-output call: Sarvam first (fast, Indic-aware), Gemini as backup.
 * Returns parsed JSON or null — every caller has a deterministic fallback.
 */
const SARVAM_LLM = "sarvam-105b-conversations";

function parse<T>(text: string | null | undefined): T | null {
  if (!text) return null;
  const clean = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/g, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(clean.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

async function sarvam(system: string, user: string, maxTokens: number, timeoutMs: number) {
  const key = process.env.SARVAM_API_KEY;
  if (!key) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "api-subscription-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        model: SARVAM_LLM,
        messages: [
          { role: "system", content: `${system}\nReply with ONE JSON object only. No prose, no markdown.` },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
        temperature: 0.2,
      }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function gemini(system: string, user: string, maxTokens: number, timeoutMs: number) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${key}`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens, temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return j.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function llmJSON<T>(system: string, user: string, opts: { maxTokens?: number; timeoutMs?: number } = {}): Promise<{ data: T; model: string } | null> {
  const max = opts.maxTokens ?? 700;
  const to = opts.timeoutMs ?? 12000;
  const s = parse<T>(await sarvam(system, user, max, to));
  if (s) return { data: s, model: "sarvam-105b" };
  const g = parse<T>(await gemini(system, user, max, to));
  if (g) return { data: g, model: "gemini" };
  return null;
}
