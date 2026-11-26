/**
 * Sarvam AI speech: Saaras v4 (speech → text) and Bulbul v4-flash (text → speech).
 * Hindi/English/Hinglish. Docs: https://docs.sarvam.ai
 */

const API = "https://api.sarvam.ai";

export function sarvamEnabled() {
  return !!process.env.SARVAM_API_KEY;
}

function key() {
  const k = process.env.SARVAM_API_KEY;
  if (!k) throw new Error("SARVAM_API_KEY missing");
  return k;
}

async function stt(audio: Blob, mode: "translit" | "codemix", filename: string) {
  const fd = new FormData();
  // Sarvam validates the bare MIME type: "audio/webm;codecs=opus" is rejected, "audio/webm" is fine
  const clean = audio.type ? new Blob([await audio.arrayBuffer()], { type: audio.type.split(";")[0].trim() }) : audio;
  fd.append("file", clean, filename);
  fd.append("model", "saaras:v4");
  fd.append("mode", mode);
  fd.append("language_code", "unknown");
  fd.append("keyterms", JSON.stringify(["Helpdeck", "Freshdesk", "Zendesk", "Clutch", "SSO", "SAML", "CSV export", "renewal", "discount", "percent", "contract", "order form", "saal"]));
  const r = await fetch(`${API}/speech-to-text`, { method: "POST", headers: { "api-subscription-key": key() }, body: fd });
  const j = (await r.json()) as { transcript?: string; language_code?: string | null; error?: { message: string } };
  if (!r.ok) throw new Error(j.error?.message ?? `stt ${r.status}`);
  return { transcript: (j.transcript ?? "").trim(), language: j.language_code ?? null };
}

/**
 * Transcribe once for the screen (Latin-script Hinglish) and once for understanding
 * (code-mixed, digits preserved), in parallel.
 */
export async function transcribe(audio: Blob, filename = "speech.webm") {
  const [display, exact] = await Promise.all([stt(audio, "translit", filename), stt(audio, "codemix", filename)]);
  return { display: display.transcript, exact: exact.transcript || display.transcript, language: exact.language ?? display.language };
}

/** Devanagari / code-mixed Hindi → Latin-script Hinglish (for the on-screen transcript). */
export async function toLatin(text: string) {
  if (!/[\u0900-\u097F]/.test(text)) return text;
  try {
    const r = await fetch(`${API}/transliterate`, {
      method: "POST",
      headers: { "api-subscription-key": key(), "content-type": "application/json" },
      body: JSON.stringify({ input: text.slice(0, 1000), source_language_code: "hi-IN", target_language_code: "en-IN" }),
    });
    const j = (await r.json()) as { transliterated_text?: string };
    return j.transliterated_text?.trim() || text;
  } catch {
    return text;
  }
}

const SPEAKER = () => process.env.SARVAM_SPEAKER || "ritu_hi_customer";

/**
 * AAC (ADTS) at 16 kHz is ~45% smaller than Bulbul's 128 kbps mp3 and plays on Android Chrome and iOS Safari —
 * it matters when every reply crosses a tunnel to a phone. SARVAM_TTS_CODEC=mp3 switches back.
 */
export const TTS_CODEC: "aac" | "mp3" = process.env.SARVAM_TTS_CODEC === "mp3" ? "mp3" : "aac";
export const TTS_MIME = TTS_CODEC === "aac" ? "audio/aac" : "audio/mpeg";

/** Split a long sentence near `max` chars at a natural pause (comma, dash, "and"/"aur"), else at a space. */
function splitLong(s: string, max: number): string[] {
  if (s.length <= max) return [s];
  const window = s.slice(0, max);
  const cuts = [...window.matchAll(/(,|;|:| —| -| and | but | so | aur | lekin | toh )/gi)].map((m) => (m.index ?? 0) + m[0].length).filter((i) => i >= 18);
  const at = cuts.length ? cuts[cuts.length - 1] : window.lastIndexOf(" ") > 18 ? window.lastIndexOf(" ") : max;
  return [s.slice(0, at).trim(), ...splitLong(s.slice(at).trim(), 140)].filter(Boolean);
}

/**
 * Split a reply for parallel synthesis. Bulbul takes ~0.75 s for a short phrase and ~12 ms per extra
 * character, so the FIRST chunk is kept short (≤ ~70 chars): the phone starts speaking in under a second
 * while the remaining chunks are synthesised in parallel and are ready before the first one finishes playing.
 */
export function chunks(text: string) {
  const sentences = text.split(/(?<=[.!?।])\s+/).map((x) => x.trim()).filter(Boolean);
  const pieces: string[] = [];
  for (const s of sentences) pieces.push(...splitLong(s, pieces.length === 0 ? 70 : 140));
  const out: string[] = [];
  for (const p of pieces) {
    const last = out.length > 1 ? out[out.length - 1] : null; // never grow the first chunk
    if (last !== null && last.length + p.length + 1 <= 140) out[out.length - 1] = `${last} ${p}`;
    else out.push(p);
  }
  return out.length > 6 ? [...out.slice(0, 5), out.slice(5).join(" ")] : out;
}

/** Parallel TTS: returns one mp3 (base64) per chunk, in order. */
export async function speakAll(text: string, lang: "en" | "hi") {
  const res = await Promise.all(chunks(text).map((c) => speak(c, lang)));
  return res.map((r) => r.audio);
}

export async function speak(text: string, lang: "en" | "hi") {
  const body = (speaker: string, language_code: string) =>
    JSON.stringify({
      text: text.slice(0, 2400),
      language_code,
      model: "bulbul:v4-flash",
      speaker,
      pace: lang === "hi" ? 1.05 : 1.08,
      speech_sample_rate: TTS_CODEC === "aac" ? 16000 : 24000,
      output_audio_codec: TTS_CODEC,
    });
  const attempt = async (speaker: string, language_code: string) => {
    const r = await fetch(`${API}/text-to-speech`, { method: "POST", headers: { "api-subscription-key": key(), "content-type": "application/json" }, body: body(speaker, language_code) });
    const j = (await r.json()) as { audios?: string[]; error?: { message: string } };
    if (!r.ok || !j.audios?.[0]) throw new Error(j.error?.message ?? `tts ${r.status}`);
    return j.audios[0];
  };
  // same voice in both languages; fall back to an English persona if the speaker rejects en-IN
  try {
    return { audio: await attempt(SPEAKER(), lang === "hi" ? "hi-IN" : "en-IN"), mime: TTS_MIME };
  } catch (e) {
    if (lang === "en") return { audio: await attempt("simran_en_customer", "en-IN"), mime: TTS_MIME };
    throw e;
  }
}
