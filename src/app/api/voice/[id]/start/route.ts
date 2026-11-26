import type { NextRequest } from "next/server";
import { dealView, getSession, resetSession } from "@/lib/negotiator";
import { speak, speakAll, TTS_MIME } from "@/lib/sarvam";
import { getAccount } from "@/lib/store";

// short clips the phone plays the instant the customer stops talking, so the wait feels natural
const FILLERS: { text: string; lang: "en" | "hi" }[] = [
  { text: "अच्छा, एक second…", lang: "hi" },
  { text: "Hmm, okay…", lang: "en" },
  { text: "समझ गई, एक moment…", lang: "hi" },
];
let fillerCache: { audio: string; lang: "en" | "hi" }[] | null = null;

async function fillers() {
  if (fillerCache) return fillerCache;
  const out = await Promise.allSettled(FILLERS.map(async (f) => ({ audio: (await speak(f.text, f.lang)).audio, lang: f.lang })));
  const ok = out.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (ok.length) fillerCache = ok;
  return ok;
}

/** Phone accepted the call: fresh voice session + the opening line as audio (+ filler clips). */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/voice/[id]/start">) {
  const { id } = await ctx.params;
  if (!getAccount(id)) return Response.json({ error: "not found" }, { status: 404 });
  resetSession(id);
  const ses = getSession(id, "voice");
  const opening = ses.messages[0];
  const [a, f] = await Promise.allSettled([speakAll(opening.speech ?? opening.text, "en"), fillers()]);
  return Response.json({
    ...dealView(id),
    audios: a.status === "fulfilled" ? a.value : [],
    mime: TTS_MIME,
    fillers: f.status === "fulfilled" ? f.value : [],
    spokenId: opening.id,
  });
}
