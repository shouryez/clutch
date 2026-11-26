"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { inr } from "@/lib/format";
import type { Contact, Offer } from "@/lib/types";

type Data = { offer: Offer; account: { id: string; name: string; plan: string; city: string }; contact?: Contact };

function Pad({ onInk }: { onInk: (has: boolean) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    c.width = r.width * dpr;
    c.height = r.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b0b0a";
    let drawing = false;
    let last: [number, number] | null = null;
    const pt = (e: PointerEvent): [number, number] => {
      const b = c.getBoundingClientRect();
      return [e.clientX - b.left, e.clientY - b.top];
    };
    const down = (e: PointerEvent) => {
      drawing = true;
      last = pt(e);
      c.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drawing || !last) return;
      const p = pt(e);
      ctx.beginPath();
      ctx.moveTo(...last);
      ctx.lineTo(...p);
      ctx.stroke();
      last = p;
      onInk(true);
    };
    const up = () => {
      drawing = false;
      last = null;
    };
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
    };
  }, [onInk]);
  return <canvas ref={ref} className="h-40 w-full touch-none rounded-xl border border-ink/15 bg-white/60" aria-label="Signature pad" />;
}

export function SignView({ id }: { id: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [ink, setInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/offers/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: Data) => {
        setD(j);
        setName(j.contact?.name ?? "");
        if (j.offer.status === "signed") setDone(true);
      })
      .catch(() => setErr("This order form link is not valid any more."));
  }, [id]);

  if (err) return <div className="grid min-h-screen place-items-center bg-bone p-8 text-ink">{err}</div>;
  if (!d) return <div className="min-h-screen bg-bone" />;
  const o = d.offer;
  const annual = Math.round(o.price / (o.termMonths / 12));

  return (
    <div className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-xl px-5 py-10">
        <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55">
          <span>Order form · {o.id.slice(-6)}</span>
          <span>via Clutch</span>
        </div>
        <h1 className="mt-6 text-[2.6rem] font-medium leading-[0.95] tracking-[-0.05em]">
          Helpdeck <span className="serif-i">×</span> {d.account.name}
        </h1>
        <p className="mt-3 text-[15px] text-ink/65">Subscription renewal. Review the terms and sign below.</p>

        <dl className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
          {[
            ["Plan", `${d.account.plan} · ${o.seats} agent seats`],
            ["Term", `${o.termMonths} months`],
            ["List price", inr(o.listPrice)],
            ...(o.discountPct ? [["Discount", `${Math.round(o.discountPct * 100)}%`]] : []),
            ...(o.extras.length ? [["Included", o.extras.join(", ")]] : []),
            ["Total", inr(o.price)],
            ["Billed", `${inr(annual)} per year · Net 30`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-6 py-3.5">
              <dt className="text-[14px] text-ink/60">{k}</dt>
              <dd className={`text-right text-[15px] ${k === "Total" ? "text-xl font-medium tracking-[-0.03em]" : ""}`}>{v}</dd>
            </div>
          ))}
        </dl>

        {done ? (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mt-10 rounded-2xl bg-ink p-6 text-bone">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-volt">Signed</div>
            <div className="mt-2 text-2xl font-medium tracking-[-0.03em]">Thank you{name ? `, ${name.split(" ")[0]}` : ""}.</div>
            <p className="mt-2 text-[14px] text-bone/70">Your subscription is updated. A copy is on its way to your inbox. You can close this page.</p>
          </motion.div>
        ) : (
          <div className="mt-10">
            <label className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55" htmlFor="nm">
              Full name
            </label>
            <input id="nm" value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full border-b border-ink/30 bg-transparent py-2 text-lg outline-none focus:border-ink" />
            <div className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55">Signature</div>
            <div className="mt-2">
              <Pad onInk={setInk} />
            </div>
            <button
              disabled={!ink || !name.trim() || busy}
              onClick={async () => {
                setBusy(true);
                const r = await fetch(`/api/offers/${id}/sign`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
                setBusy(false);
                if (r.ok) setDone(true);
              }}
              className="mt-6 w-full rounded-full bg-ink py-4 font-mono text-[12px] uppercase tracking-[0.14em] text-bone transition disabled:opacity-30"
            >
              {busy ? "Signing…" : "Sign & accept"}
            </button>
            <p className="mt-4 text-center text-[11.5px] text-ink/50">By signing you agree to the Helpdeck MSA. This is a demo order form.</p>
          </div>
        )}
      </div>
    </div>
  );
}
