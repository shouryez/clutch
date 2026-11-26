import { connection } from "next/server";
import { briefing } from "@/lib/brief";
import { sarvamEnabled, speak, TTS_MIME } from "@/lib/sarvam";

const cache = new Map<string, string[]>();

export async function GET() {
  await connection();
  return Response.json(briefing());
}

/** Read the brief aloud (Sarvam Bulbul). Cached per text so replays are instant. */
export async function POST() {
  const { text } = briefing();
  if (!sarvamEnabled()) return Response.json({ error: "voice not configured" }, { status: 503 });
  try {
    const hit = cache.get(text);
    const audios = hit ?? (await Promise.all(text.split(/(?<=[.!?])\s+/).filter(Boolean).map(async (t) => (await speak(t, "en")).audio)));
    if (!hit) cache.set(text, audios);
    return Response.json({ audios, mime: TTS_MIME, text });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
