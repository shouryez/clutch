"use client";

/**
 * The judge's phone. Incoming call → accept → a real spoken conversation.
 *
 * Two engines, same UI:
 *  - "sarvam"  (server has SARVAM_API_KEY): mic → voice-activity detection → MediaRecorder clip →
 *              /api/voice/[id]/turn (Sarvam STT → Gemini + deal desk → Sarvam TTS) → mp3 clips played in order.
 *              A short filler ("Achha, ek second…") plays the instant the customer stops talking.
 *  - "browser" (no key, or no mic): Web Speech API recognition + speechSynthesis, brain via /api/deal/[id].
 */
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { inr } from "@/lib/format";
import type { dealView, Lang, Msg } from "@/lib/negotiator";

type Deal = ReturnType<typeof dealView>;
type Phase = "ringing" | "connecting" | "live" | "ended";
type Engine = "sarvam" | "browser";
type TurnResponse = Deal & { audios?: string[]; mime?: string; heard?: string; empty?: boolean; error?: string; fillers?: { audio: string; lang: Lang }[]; clips?: number };

/** Read a newline-delimited JSON stream (falls back to a single JSON body). */
async function* ndjson(r: Response): AsyncGenerator<Record<string, unknown>> {
  if (!r.body) {
    yield (await r.json()) as Record<string, unknown>;
    return;
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) yield JSON.parse(line) as Record<string, unknown>;
    }
  }
  if (buf.trim()) yield JSON.parse(buf) as Record<string, unknown>;
}

type Clips = string[] | AsyncIterator<string> | null;

/* ---------- browser speech types ---------- */
type SRResult = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type SR = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<SRResult> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type SRCtor = new () => SR;
const getSR = () => {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};
const activated = () => (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive;

/** 0.1 s of silence as a WAV data URI — played inside the Accept tap to unlock audio output on mobile. */
function silentWav() {
  const rate = 8000;
  const n = rate / 10;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + n, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  w(36, "data");
  v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  let bin = "";
  new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

function useRingtone() {
  const ctx = useRef<AudioContext | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (activated()) navigator.vibrate?.(0);
  }, []);
  const start = useCallback(() => {
    try {
      ctx.current ??= new AudioContext();
      const ac = ctx.current;
      void ac.resume();
      const burst = () => {
        const t = ac.currentTime;
        for (const [on, off] of [[0, 0.4], [0.6, 1.0]]) {
          for (const f of [440, 480]) {
            const o = ac.createOscillator();
            const g = ac.createGain();
            o.frequency.value = f;
            g.gain.setValueAtTime(0, t + on);
            g.gain.linearRampToValueAtTime(0.08, t + on + 0.02);
            g.gain.setValueAtTime(0.08, t + off - 0.02);
            g.gain.linearRampToValueAtTime(0, t + off);
            o.connect(g).connect(ac.destination);
            o.start(t + on);
            o.stop(t + off + 0.05);
          }
        }
        if (activated()) navigator.vibrate?.([400, 200, 400]);
      };
      stop();
      burst();
      timer.current = setInterval(burst, 3000);
    } catch {
      /* no audio */
    }
  }, [stop]);
  return { start, stop };
}

function pickVoice(lang: Lang) {
  const vs = window.speechSynthesis?.getVoices() ?? [];
  const want = lang === "hi" ? ["hi-IN", "hi"] : ["en-IN", "en-GB", "en-US", "en"];
  for (const w of want) {
    const v = vs.find((x) => x.lang.replace("_", "-").startsWith(w) && /google|microsoft|natural|neural/i.test(x.name)) ?? vs.find((x) => x.lang.replace("_", "-").startsWith(w));
    if (v) return v;
  }
  return undefined;
}

export function PhoneCall({ id }: { id: string }) {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [phase, setPhase] = useState<Phase>("ringing");
  const [deal, setDeal] = useState<Deal | null>(null);
  const [interim, setInterim] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [level, setLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const [typed, setTyped] = useState("");
  const [showKeys, setShowKeys] = useState(false);
  const [secs, setSecs] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const ring = useRingtone();

  const phaseRef = useRef<Phase>("ringing");
  const engineRef = useRef<Engine>("browser");
  const busyRef = useRef(false);
  const speakingRef = useRef(false);
  const mutedRef = useRef(false);
  const listenRef = useRef<() => void>(() => {});
  const spoken = useRef(new Set<string>());
  // sarvam engine
  const player = useRef<HTMLAudioElement | null>(null);
  const mime = useRef("audio/mpeg");
  const stopPlayback = useRef<(() => void) | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const vadTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fillers = useRef<string[]>([]);
  const holding = useRef(false);
  const [held, setHeld] = useState(false);
  // browser engine
  const recRef = useRef<SR | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    fetch("/api/voice/status")
      .then((r) => r.json())
      .then((s: { sarvam: boolean }) => {
        const e: Engine = s.sarvam && typeof MediaRecorder !== "undefined" ? "sarvam" : "browser";
        engineRef.current = e;
        setEngine(e);
      })
      .catch(() => setEngine("browser"));
  }, []);

  useEffect(() => {
    const kick = () => phaseRef.current === "ringing" && ring.start();
    kick();
    window.addEventListener("pointerdown", kick, { once: true });
    window.speechSynthesis?.getVoices();
    return () => {
      window.removeEventListener("pointerdown", kick);
      ring.stop();
    };
  }, [ring]);

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  /* ---------------- playback ---------------- */

  /** Play clips as they arrive: the first sentence starts while the rest are still being synthesised. */
  const playClips = useCallback((clips: string[] | AsyncIterator<string>) => {
    const feed: AsyncIterator<string> = Array.isArray(clips) ? (clips[Symbol.iterator]() as unknown as AsyncIterator<string>) : clips;
    return new Promise<number>((resolve) => {
      const el = player.current;
      if (!el) return resolve(0);
      let played = 0;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.onended = null;
        el.onerror = null;
        stopPlayback.current = null;
        resolve(played);
      };
      stopPlayback.current = () => {
        el.pause();
        finish();
      };
      const next = async () => {
        if (done) return;
        let r: IteratorResult<string>;
        try {
          r = await feed.next();
        } catch {
          return finish();
        }
        if (done) return;
        if (r.done || !r.value) return finish();
        played++;
        el.src = `data:${mime.current};base64,${r.value}`;
        el.play().catch(() => void next());
      };
      el.onended = () => void next();
      el.onerror = () => void next();
      void next();
    });
  }, []);

  const say = useCallback(
    async (clips: Clips, fallbackText: string, lang: Lang) => {
      speakingRef.current = true;
      setSpeaking(true);
      let played = 0;
      if (clips && (!Array.isArray(clips) || clips.length) && player.current) played = await playClips(clips);
      if (!played && window.speechSynthesis && phaseRef.current === "live") {
        await new Promise<void>((resolve) => {
          const u = new SpeechSynthesisUtterance(fallbackText.replace(/₹/g, "rupees ").replace(/—/g, ", "));
          const v = pickVoice(lang);
          if (v) u.voice = v;
          u.lang = lang === "hi" ? "hi-IN" : "en-IN";
          u.onend = () => resolve();
          u.onerror = () => resolve();
          stopPlayback.current = () => {
            window.speechSynthesis.cancel();
            resolve();
          };
          window.speechSynthesis.speak(u);
        });
        stopPlayback.current = null;
      }
      speakingRef.current = false;
      setSpeaking(false);
      if (phaseRef.current === "live") setTimeout(() => listenRef.current(), 150);
    },
    [playClips],
  );

  /* ---------------- turns ---------------- */

  const afterTurn = useCallback(
    async (d: TurnResponse, feed?: AsyncIterator<string>) => {
      if (d.error) setNote(d.error);
      if (d.session) setDeal(d);
      if (d.empty || !d.session) {
        busyRef.current = false;
        setThinking(false);
        setInterim("");
        listenRef.current();
        return;
      }
      const msgs = d.session.messages;
      const lastCustomer = msgs.map((m) => m.who).lastIndexOf("customer");
      const replies = msgs.slice(lastCustomer + 1).filter((m) => m.who === "clutch");
      replies.forEach((m) => spoken.current.add(m.id));
      busyRef.current = false;
      setThinking(false);
      setInterim("");
      await say(feed ?? d.audios ?? null, replies.map((m) => m.text).join(" "), d.session.lang);
    },
    [say],
  );

  /** POST a turn and stream the reply: header (transcript, deal) first, then one audio clip per sentence. */
  const streamTurn = useCallback(async (body: BodyInit, headers?: HeadersInit) => {
    const r = await fetch(`/api/voice/${id}/turn?stream=1`, { method: "POST", body, headers });
    const it = ndjson(r);
    const first = (await it.next()).value as TurnResponse | undefined;
    if (!first) throw new Error("empty reply");
    if (first.mime) mime.current = first.mime;
    const feed = (async function* () {
      for await (const x of it) if (typeof x.audio === "string") yield x.audio;
    })();
    return { d: first, feed };
  }, [id]);

  const sendText = useCallback(
    async (text: string) => {
      if (!text.trim() || busyRef.current) return;
      busyRef.current = true;
      setThinking(true);
      setInterim(text);
      try {
        if (engineRef.current === "sarvam") {
          const { d, feed } = await streamTurn(JSON.stringify({ text, channel: "voice" }), { "content-type": "application/json" });
          await afterTurn(d, feed);
        } else {
          const r = await fetch(`/api/deal/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, channel: "voice" }) });
          await afterTurn((await r.json()) as TurnResponse);
        }
      } catch {
        busyRef.current = false;
        setThinking(false);
        listenRef.current();
      }
    },
    [afterTurn, id, streamTurn],
  );

  const sendAudio = useCallback(
    async (blob: Blob, ext: string) => {
      busyRef.current = true;
      setThinking(true);
      // a filler covers the thinking time
      const f = fillers.current.length ? fillers.current[Math.floor(Math.random() * fillers.current.length)] : null;
      const fillerDone = f && player.current ? playClips([f]) : Promise.resolve();
      try {
        const fd = new FormData();
        fd.append("audio", blob, `speech.${ext}`);
        const { d, feed } = await streamTurn(fd);
        if (d.heard) setInterim(d.heard);
        await fillerDone;
        await afterTurn(d, feed);
      } catch {
        busyRef.current = false;
        setThinking(false);
        listenRef.current();
      }
    },
    [afterTurn, playClips, streamTurn],
  );

  /* ---------------- listening: sarvam (VAD + MediaRecorder) ---------------- */

  const stopVad = () => {
    if (vadTimer.current) clearInterval(vadTimer.current);
    vadTimer.current = null;
  };

  const listenSarvam = useCallback(() => {
    if (phaseRef.current !== "live" || speakingRef.current || busyRef.current || mutedRef.current) return;
    const s = stream.current;
    const an = analyser.current;
    if (!s || !an) return;
    stopVad();
    if (recorder.current?.state === "recording") return;
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
    const ext = mime.includes("mp4") ? "m4a" : "webm";
    const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
    const parts: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) parts.push(e.data);
    };
    let heard = false;
    let loudFrames = 0;
    let lastLoud = 0;
    let floor = 0;
    let floorN = 0;
    const started = performance.now();
    rec.onstop = () => {
      stopVad();
      setListening(false);
      setLevel(0);
      if (heard && parts.length && phaseRef.current === "live" && !mutedRef.current) void sendAudio(new Blob(parts, { type: mime || "audio/webm" }), ext);
      else if (phaseRef.current === "live" && !busyRef.current && !speakingRef.current) setTimeout(() => listenRef.current(), 100);
    };
    rec.start(200);
    recorder.current = rec;
    setListening(true);
    const buf = new Float32Array(an.fftSize);
    vadTimer.current = setInterval(() => {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();
      if (now - started < 350) {
        floor += rms;
        floorN++;
        return;
      }
      const thr = Math.max(0.01, (floor / Math.max(1, floorN)) * 2.2);
      setLevel(Math.min(1, rms / (thr * 3)));
      if (rms > thr) {
        loudFrames++;
        if (loudFrames >= 3) {
          heard = true;
          lastLoud = now;
        }
      } else loudFrames = Math.max(0, loudFrames - 1);
      const tooLong = now - started > 25000;
      const idle = !heard && now - started > 14000;
      if (holding.current) {
        heard = true;
        lastLoud = now;
        return;
      }
      if ((heard && now - lastLoud > 900) || tooLong || idle) {
        stopVad();
        if (rec.state === "recording") rec.stop();
      }
    }, 50);
  }, [sendAudio]);

  /* ---------------- listening: browser (Web Speech) ---------------- */

  const listenBrowser = useCallback(() => {
    if (phaseRef.current !== "live" || speakingRef.current || busyRef.current || mutedRef.current) return;
    const Ctor = getSR();
    if (!Ctor) {
      setShowKeys(true);
      setNote("Speech recognition isn't available in this browser — type instead.");
      return;
    }
    try {
      recRef.current?.abort();
      const rec = new Ctor();
      rec.lang = "en-IN";
      rec.interimResults = true;
      rec.continuous = false;
      let finalText = "";
      rec.onresult = (e) => {
        let txt = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          txt += e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        }
        setInterim(txt);
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setShowKeys(true);
          setNote("Microphone blocked — type instead.");
        }
      };
      rec.onend = () => {
        setListening(false);
        if (finalText.trim()) void sendText(finalText.trim());
        else if (phaseRef.current === "live" && !speakingRef.current && !busyRef.current) setTimeout(() => listenRef.current(), 250);
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [sendText]);

  useEffect(() => {
    listenRef.current = () => (engineRef.current === "sarvam" ? listenSarvam() : listenBrowser());
  }, [listenSarvam, listenBrowser]);

  /* ---------------- messages we didn't trigger (e.g. manager approval on the big screen) ---------------- */

  useEffect(() => {
    if (phase !== "live") return;
    const es = new EventSource("/api/events");
    es.onmessage = async (m) => {
      const ev = JSON.parse(m.data) as { kind: string; accountId?: string; title: string };
      if (ev.accountId !== id || ev.kind !== "call" || ev.title !== "Clutch") return;
      if (busyRef.current) return; // our own turn — the turn response handles it
      const d = (await (await fetch(`/api/deal/${id}`)).json()) as Deal;
      setDeal(d);
      const last = [...d.session.messages].reverse().find((x) => x.who === "clutch");
      if (!last || spoken.current.has(last.id) || busyRef.current) return;
      spoken.current.add(last.id);
      stopVad();
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
        setListening(false);
      }
      recRef.current?.abort();
      if (engineRef.current === "sarvam") {
        const r = (await (await fetch(`/api/voice/${id}/say`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messageId: last.id }) })).json()) as { audios?: string[]; mime?: string };
        if (r.mime) mime.current = r.mime;
        await say(r.audios ?? null, last.text, last.lang);
      } else await say(null, last.text, last.lang);
    };
    return () => es.close();
  }, [phase, id, say]);

  /* ---------------- call controls ---------------- */

  const accept = async () => {
    ring.stop();
    setPhase("connecting");
    // Android Chrome: an AudioContext created outside the tap stays suspended and the VAD hears silence
    const ac = new AudioContext();
    void ac.resume();
    // unlock audio output inside the user gesture
    const el = new Audio(silentWav());
    void el.play().catch(() => {});
    player.current = el;
    window.speechSynthesis?.speak(new SpeechSynthesisUtterance(""));

    if (engineRef.current === "sarvam") {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        stream.current = s;
        if (ac.state !== "running") await ac.resume().catch(() => {});
        const an = ac.createAnalyser();
        an.fftSize = 1024;
        ac.createMediaStreamSource(s).connect(an);
        analyser.current = an;
      } catch {
        // no mic (e.g. plain http on a phone): keep Sarvam voice out, type in
        setShowKeys(true);
        setNote("Microphone unavailable (needs HTTPS) — type your replies, Clutch still speaks.");
      }
    }

    const url = engineRef.current === "sarvam" ? `/api/voice/${id}/start` : `/api/deal/${id}/reset`;
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel: "voice" }) });
    const d = (await r.json()) as TurnResponse;
    if (d.mime) mime.current = d.mime;
    setDeal(d);
    fillers.current = (d.fillers ?? []).map((f) => f.audio);
    const opening = d.session.messages[0];
    spoken.current.add(opening.id);
    setPhase("live");
    phaseRef.current = "live";
    await say(d.audios ?? null, opening.text, "en");
  };

  const end = () => {
    if (phaseRef.current === "live") void fetch(`/api/deal/${id}/summary`, { method: "POST" }).catch(() => {});
    phaseRef.current = "ended";
    setPhase("ended");
    stopVad();
    if (recorder.current?.state === "recording") {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    recRef.current?.abort();
    stopPlayback.current?.();
    window.speechSynthesis?.cancel();
    stream.current?.getTracks().forEach((t) => t.stop());
    ring.stop();
  };

  const interrupt = () => {
    if (speakingRef.current) stopPlayback.current?.();
  };

  const msgs: Msg[] = deal?.session.messages ?? [];
  const offer = deal?.offer;
  const lang = deal?.session.lang ?? "en";
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const status = speaking ? "speaking · tap to interrupt" : thinking ? "thinking" : listening ? "listening" : "…";

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-ink text-bone" onClick={interrupt}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[55vh] bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,90,31,0.22),transparent_65%)]" />

      <div className="relative flex flex-col items-center px-6 pt-[8vh] text-center">
        <div className="relative grid h-24 w-24 place-items-center rounded-full bg-signal text-ink">
          {(phase === "ringing" || speaking) && <span className="ring-pulse absolute inset-0 rounded-full text-signal" />}
          <span className="text-4xl font-semibold tracking-tighter">c.</span>
        </div>
        <div className="mt-6 text-3xl tracking-[-0.03em]">Clutch</div>
        <div className="mt-1 text-[14px] text-ash">Helpdeck renewals · AI assistant</div>
        <div className="mt-3 font-mono text-[12px] uppercase tracking-[0.16em] text-ash">
          {phase === "ringing" && "incoming call…"}
          {phase === "connecting" && "connecting…"}
          {phase === "live" && (
            <span className="tabular-nums">
              {mm}:{ss} · <span className={speaking ? "text-signal" : listening ? "text-volt" : "text-bone"}>{status}</span>
              {lang === "hi" && <span className="ml-2 text-signal">हिं</span>}
            </span>
          )}
          {phase === "ended" && "call ended"}
        </div>
        {engine && phase !== "ringing" && (
          <div className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ash/70">{engine === "sarvam" ? "sarvam saaras · bulbul · sarvam-105b" : "on-device voice"}</div>
        )}
      </div>

      {phase === "live" && engine === "sarvam" && (
        <div className="relative mx-auto mt-3 flex w-40 items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ash">
          mic
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-line">
            <span className="block h-full rounded-full bg-volt transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
          </span>
        </div>
      )}
      {phase === "live" && (
        <div className="relative mt-5 flex h-14 items-center justify-center gap-[3px]">
          {Array.from({ length: 36 }).map((_, i) => {
            const active = speaking || thinking;
            const h = listening ? 4 + level * (10 + ((i * 37) % 38)) : 4;
            return (
              <motion.span
                key={i}
                className={`w-[3px] rounded-full ${speaking ? "bg-signal" : thinking ? "bg-bone/40" : "bg-volt/80"}`}
                animate={active ? { height: [4, 8 + ((i * 37) % 44), 4] } : { height: h }}
                transition={active ? { duration: 0.5 + (i % 5) * 0.08, repeat: Infinity, delay: i * 0.02 } : { duration: 0.08 }}
              />
            );
          })}
        </div>
      )}

      <div className="relative mt-4 flex-1 overflow-hidden px-5 [mask-image:linear-gradient(to_bottom,transparent,black_18%)]">
        <div className="flex h-full flex-col justify-end gap-2.5 pb-4">
          <AnimatePresence initial={false}>
            {msgs.slice(-4).map((m) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug ${
                  m.who === "clutch" ? "bg-carbon" : m.who === "customer" ? "ml-auto bg-bone text-ink" : "mx-auto border border-volt/40 font-mono text-[11.5px] text-volt"
                }`}
              >
                {m.text}
              </motion.div>
            ))}
          </AnimatePresence>
          {interim && <div className="ml-auto max-w-[88%] rounded-2xl border border-line px-3.5 py-2.5 text-[14px] italic text-ash">{interim}</div>}
          {offer && (
            <motion.a
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              href={`/sign/${offer.id}`}
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className={`mt-1 block rounded-2xl p-4 ${offer.status === "signed" ? "bg-volt text-ink" : "bg-bone text-ink"}`}
            >
              <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] opacity-60">{offer.status === "signed" ? "signed ✓" : "order form · tap to sign"}</div>
              <div className="mt-1 text-xl font-medium tracking-[-0.03em]">
                {inr(offer.price)} · {offer.termMonths} months
              </div>
            </motion.a>
          )}
          {note && <div className="mx-auto text-center font-mono text-[10.5px] text-ash">{note}</div>}
        </div>
      </div>

      {phase === "live" && showKeys && (
        <form
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            const t = typed;
            setTyped("");
            void sendText(t);
          }}
          className="relative mx-5 mb-3 flex gap-2"
        >
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type instead…" className="flex-1 rounded-full border border-line bg-carbon px-4 py-3 text-[15px] outline-none" />
          <button className="rounded-full bg-bone px-4 font-mono text-[11px] uppercase text-ink">Send</button>
        </form>
      )}

      <div className="relative flex items-center justify-center gap-10 pb-[7vh] pt-3" onClick={(e) => e.stopPropagation()}>
        {phase === "ringing" && (
          <>
            <button onClick={end} className="flex flex-col items-center gap-2">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-carbon font-mono text-[11px] uppercase">✕</span>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ash">Decline</span>
            </button>
            <button onClick={accept} disabled={!engine} className="flex flex-col items-center gap-2 disabled:opacity-40">
              <motion.span animate={{ y: [0, -6, 0] }} transition={{ duration: 1, repeat: Infinity }} className="grid h-16 w-16 place-items-center rounded-full bg-volt font-mono text-[11px] uppercase text-ink">
                ✆
              </motion.span>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ash">Accept</span>
            </button>
          </>
        )}
        {(phase === "live" || phase === "connecting") && (
          <>
            <button
              onClick={() => {
                const m = !muted;
                setMuted(m);
                mutedRef.current = m;
                if (m) {
                  stopVad();
                  if (recorder.current?.state === "recording") recorder.current.stop();
                  recRef.current?.abort();
                } else listenRef.current();
              }}
              className="flex flex-col items-center gap-2"
            >
              <span className={`grid h-14 w-14 place-items-center rounded-full font-mono text-[10px] uppercase ${muted ? "bg-bone text-ink" : "bg-carbon"}`}>mic</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ash">{muted ? "muted" : "mute"}</span>
            </button>
            <button onClick={end} className="flex flex-col items-center gap-2">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-signal font-mono text-[11px] uppercase text-ink">end</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ash">End</span>
            </button>
            <button onClick={() => setShowKeys((x) => !x)} className="flex flex-col items-center gap-2">
              <span className={`grid h-14 w-14 place-items-center rounded-full font-mono text-[10px] uppercase ${showKeys ? "bg-bone text-ink" : "bg-carbon"}`}>abc</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ash">type</span>
            </button>
            {engine === "sarvam" && (
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (speakingRef.current) stopPlayback.current?.();
                  holding.current = true;
                  setHeld(true);
                  if (recorder.current?.state !== "recording") setTimeout(() => listenRef.current(), 60);
                }}
                onPointerUp={() => {
                  holding.current = false;
                  setHeld(false);
                  if (vadTimer.current) clearInterval(vadTimer.current);
                  vadTimer.current = null;
                  if (recorder.current?.state === "recording") recorder.current.stop();
                }}
                onPointerCancel={() => {
                  holding.current = false;
                  setHeld(false);
                }}
                className="flex select-none flex-col items-center gap-2 [touch-action:none]"
              >
                <span className={`grid h-14 w-14 place-items-center rounded-full font-mono text-[10px] uppercase transition ${held ? "scale-110 bg-volt text-ink" : "bg-carbon"}`}>hold</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ash">{held ? "release" : "to talk"}</span>
              </button>
            )}
          </>
        )}
        {phase === "ended" && (
          <button onClick={() => location.reload()} className="rounded-full border border-line px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em]">
            Call again
          </button>
        )}
      </div>
    </div>
  );
}
