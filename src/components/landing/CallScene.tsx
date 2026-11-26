"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useRef, useState } from "react";
import { Aurora, GridBg } from "@/components/fx/Ambient";
import { Label } from "@/components/fx/Reveal";

type Line = { who: "clutch" | "rohan" | "sys"; lang: "EN" | "HI"; text: string; sentiment: number; risk: number };

const script: Line[] = [
  { who: "clutch", lang: "EN", text: "Hi Rohan, this is Clutch — Helpdeck’s AI renewal assistant. I saw exports failed 14 times for your team this month. Got two minutes?", sentiment: -0.2, risk: 81 },
  { who: "rohan", lang: "HI", text: "Haan yaar, bahut problem ho rahi hai. Honestly, hum Freshdesk dekh rahe hain.", sentiment: -0.75, risk: 84 },
  { who: "clutch", lang: "HI", text: "Samajh sakti hoon. Export fix Thursday ko ship ho raha hai — main khud track kar rahi hoon. Waise, 40 seats migrate karne ka cost lagbhag ₹6 lakh aayega.", sentiment: -0.3, risk: 66 },
  { who: "rohan", lang: "HI", text: "Fine. Lekin 25% discount do, warna mushkil hai.", sentiment: -0.4, risk: 61 },
  { who: "clutch", lang: "HI", text: "25 possible nahi hai. 12% kar sakti hoon agar aap 2 saal ke liye renew karein. Order form abhi bhej doon?", sentiment: 0.2, risk: 38 },
  { who: "rohan", lang: "HI", text: "Theek hai, bhejo.", sentiment: 0.55, risk: 22 },
  { who: "sys", lang: "EN", text: "Order form sent → signed at 00:47 → Stripe updated → #renewals notified", sentiment: 0.7, risk: 9 },
];

function Meter({ label, value, min, max, tone }: { label: string; value: number; min: number; max: number; tone: string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-ash">
        <span>{label}</span>
        <motion.span key={value} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-bone tabular-nums">
          {label === "Sentiment" ? (value > 0 ? "+" : "") + value.toFixed(2) : value}
        </motion.span>
      </div>
      <div className="relative mt-2 h-1.5 rounded-full bg-line">
        <motion.div className={`absolute inset-y-0 left-0 rounded-full ${tone}`} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 80, damping: 18 }} />
      </div>
    </div>
  );
}

export function CallScene() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [n, setN] = useState(1);
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    setN(Math.max(1, Math.min(script.length, Math.floor(p * (script.length + 0.6)) + 1)));
  });
  const shown = script.slice(0, n);
  const cur = shown[shown.length - 1];
  const lang = [...shown].reverse().find((l) => l.who !== "sys")!.lang;

  return (
    <section id="call" ref={ref} className="relative h-[420vh] bg-ink">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <Aurora tone="signal" intensity={0.7} />
        <GridBg dots size={30} />
        <div className="mx-auto grid w-full max-w-[1600px] items-center gap-10 px-5 md:grid-cols-12 md:px-10">
          {/* copy */}
          <div className="md:col-span-4">
            <Label n="05">The call</Label>
            <h2 className="mt-8 text-[clamp(2.8rem,5.6vw,6rem)] font-medium leading-[0.9] tracking-[-0.05em]">
              It doesn’t send a survey.
              <br />
              <span className="serif-i text-signal">It calls.</span>
            </h2>
            <p className="mt-8 max-w-sm text-[15px] leading-relaxed text-ash">
              Scan a QR on the big screen and your phone rings. Clutch knows the account, answers in the language you
              answer in, and can be interrupted mid-sentence.
            </p>
            <div className="mt-10 grid max-w-sm gap-5">
              <Meter label="Sentiment" value={cur.sentiment} min={-1} max={1} tone="bg-volt" />
              <Meter label="Churn risk" value={cur.risk} min={0} max={100} tone="bg-signal" />
            </div>
          </div>

          {/* phone */}
          <div className="relative mx-auto md:col-span-4">
            <div className="relative h-[620px] w-[310px] rounded-[48px] border border-line bg-carbon p-3 shadow-[0_60px_160px_-40px_rgba(255,90,31,0.35)]">
              <div className="absolute left-1/2 top-3 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-ink" />
              <div className="flex h-full flex-col overflow-hidden rounded-[38px] bg-ink px-5 pb-6 pt-12">
                <div className="text-center">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">Clutch · AI assistant</div>
                  <div className="mt-1 text-xl tracking-tight">Helpdeck Renewals</div>
                  <div className="mt-1 font-mono text-[12px] tabular-nums text-ash">0{Math.floor(n / 2)}:{String((n * 17) % 60).padStart(2, "0")}</div>
                </div>
                <div className="mt-4 flex h-12 items-center justify-center gap-[3px]">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <motion.span
                      key={i}
                      className={`w-[3px] rounded-full ${cur.who === "rohan" ? "bg-bone" : "bg-signal"}`}
                      animate={{ height: [4, 6 + ((i * 29 + n * 11) % 40), 4] }}
                      transition={{ duration: 0.6 + (i % 5) * 0.1, repeat: Infinity, delay: i * 0.02 }}
                    />
                  ))}
                </div>
                <div className="mt-4 flex-1 space-y-3 overflow-hidden">
                  <AnimatePresence initial={false}>
                    {shown.slice(-4).map((l) => (
                      <motion.div
                        layout
                        key={l.text}
                        initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -24 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug ${
                          l.who === "clutch"
                            ? "mr-6 bg-carbon text-bone"
                            : l.who === "rohan"
                              ? "ml-6 bg-bone text-ink"
                              : "border border-volt/40 font-mono text-[11px] text-volt"
                        }`}
                      >
                        {l.text}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <div className="mt-4 flex justify-center gap-8">
                  <span className="grid h-12 w-12 place-items-center rounded-full border border-line font-mono text-[10px] text-ash">mute</span>
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-signal font-mono text-[10px] text-ink">end</span>
                </div>
              </div>
            </div>
          </div>

          {/* language + big screen mirror */}
          <div className="md:col-span-3 md:col-start-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash">Detected language</div>
            <div className="relative mt-3 h-[clamp(5rem,9vw,9rem)] overflow-hidden">
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={lang}
                  initial={{ y: "100%" }}
                  animate={{ y: "0%" }}
                  exit={{ y: "-100%" }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className={`text-[clamp(5rem,9vw,9rem)] font-medium leading-none tracking-[-0.06em] ${lang === "HI" ? "text-signal" : ""}`}
                >
                  {lang === "HI" ? "हिं" : "EN"}
                </motion.div>
              </AnimatePresence>
            </div>
            <p className="mt-4 text-sm text-ash">
              {lang === "HI" ? "Customer switched to Hinglish. Clutch followed." : "Opening in English."}
            </p>
            <div className="mt-10 space-y-2 border-t border-line pt-5 font-mono text-[11px] text-ash">
              {["get_account_brief()", "lookup_competitor_pricing(“Freshdesk”)", "propose_offer(0.25) → rejected", "propose_offer(0.12, 24mo) → ok", "send_order_form()"].map(
                (t, i) => (
                  <div key={t} className={`transition-colors duration-500 ${i < n - 1 ? (t.includes("rejected") ? "text-signal" : "text-bone") : "opacity-30"}`}>
                    {i < n - 1 ? "▸" : "·"} {t}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
