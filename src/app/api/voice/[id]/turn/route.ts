import type { NextRequest } from "next/server";
import { dealView, respond } from "@/lib/negotiator";
import { chunks, speak, toLatin, transcribe, TTS_MIME } from "@/lib/sarvam";
import { emit } from "@/lib/store";
import { getAccount } from "@/lib/store";

/**
 * One spoken turn from the phone: audio (or typed text) in → Sarvam STT → negotiator → Sarvam TTS → audio out.
 * With ?stream=1 the reply is NDJSON: the transcript + deal first, then one clip per sentence as soon as it is
 * synthesised — the phone starts talking after the first sentence instead of waiting for the whole reply.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/voice/[id]/turn">) {
  const { id } = await ctx.params;
  if (!getAccount(id)) return Response.json({ error: "not found" }, { status: 404 });
  const t0 = Date.now();
  let exact = "";
  let display = "";
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("multipart/form-data")) {
      const fd = await req.formData();
      const file = fd.get("audio");
      if (!(file instanceof Blob) || file.size < 1200) return Response.json({ empty: true });
      const name = (file as File).name || "speech.webm";
      const tr = await transcribe(file, name);
      exact = tr.exact;
      display = tr.display;
    } else {
      const b = (await req.json()) as { text?: string };
      exact = display = (b.text ?? "").trim();
    }
  } catch (e) {
    return Response.json({ error: `stt: ${(e as Error).message}` }, { status: 502 });
  }
  if (!exact) return Response.json({ empty: true });
  const t1 = Date.now();

  const ses = await respond(id, exact.slice(0, 600), "voice", display.slice(0, 600));
  const t2 = Date.now();
  const lastCustomer = ses.messages.map((m) => m.who).lastIndexOf("customer");
  const replies = ses.messages.slice(lastCustomer + 1).filter((m) => m.who === "clutch");
  const speech = replies.map((m) => m.speech ?? m.text).join(" ");
  // every sentence is synthesised in parallel; the Latin-script transcript alongside
  const tts = speech ? chunks(speech).map((c) => speak(c, ses.lang).then((r) => r.audio)) : [];
  tts.forEach((p) => p.catch(() => undefined));
  const latin = await Promise.allSettled(replies.map((m) => toLatin(m.text))).then((xs) => xs.map((x, i) => (x.status === "fulfilled" ? x.value : replies[i].text)));
  let changed = false;
  replies.forEach((m, i) => {
    if (latin[i] !== m.text) {
      m.speech ??= m.text;
      m.text = latin[i];
      changed = true;
    }
  });
  if (changed) emit({ kind: "deal", accountId: id, title: "transcript", detail: "updated", tone: "neutral" });

  const head = { ...dealView(id), heard: display, mime: TTS_MIME, clips: tts.length, spokenId: replies[replies.length - 1]?.id ?? null };
  if (new URL(req.url).searchParams.has("stream")) {
    const enc = new TextEncoder();
    const body = new ReadableStream({
      async start(ctrl) {
        const line = (o: unknown) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
        line({ ...head, timing: { stt: t1 - t0, brain: t2 - t1 } });
        for (let i = 0; i < tts.length; i++) {
          try {
            line({ clip: i, audio: await tts[i], ms: Date.now() - t2 });
          } catch (e) {
            line({ clip: i, error: (e as Error).message });
          }
        }
        ctrl.close();
      },
    });
    return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no" } });
  }
  const audios = (await Promise.allSettled(tts)).flatMap((x) => (x.status === "fulfilled" ? [x.value] : []));
  return Response.json({
    ...head,
    audios,
    timing: { stt: t1 - t0, brain: t2 - t1, tts: Date.now() - t2 },
  });
}
