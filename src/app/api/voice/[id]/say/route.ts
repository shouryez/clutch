import type { NextRequest } from "next/server";
import { getSession } from "@/lib/negotiator";
import { speakAll, TTS_MIME } from "@/lib/sarvam";

/** Speak a Clutch message the phone didn't trigger itself (e.g. "approved!" after the manager clicks). */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/voice/[id]/say">) {
  const { id } = await ctx.params;
  const { messageId } = (await req.json()) as { messageId?: string };
  const m = getSession(id, "voice").messages.find((x) => x.id === messageId && x.who === "clutch");
  if (!m) return Response.json({ error: "not found" }, { status: 404 });
  try {
    const audios = await speakAll(m.speech ?? m.text, m.lang);
    return Response.json({ audios, mime: TTS_MIME, spokenId: m.id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
