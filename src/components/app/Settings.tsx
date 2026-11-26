"use client";

import { useState } from "react";
import { PLAYBOOK } from "@/lib/playbook";
import type { Autonomy, Settings as S } from "@/lib/settings";
import type { PlayKey } from "@/lib/types";
import { Loading } from "./CommandCenter";
import { post, useApi } from "./live";
import { Mono, page, PageHeader, Panel } from "./ui";

const LADDER = [
  { d: 0.05, t: 12 },
  { d: 0.08, t: 24 },
  { d: 0.1, t: 24 },
  { d: 0.12, t: 24 },
  { d: 0.15, t: 36 },
];

const MODES: { k: Autonomy; label: string; hint: string }[] = [
  { k: "off", label: "Off", hint: "Never runs" },
  { k: "ask", label: "Ask me", hint: "Autopilot queues it in your Inbox" },
  { k: "auto", label: "Autopilot", hint: "Runs on its own" },
];

function Slider({ label, value, min, max, step, onChange, fmt, hint }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string; hint: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[14px]">{label}</span>
        <span className="font-mono text-[18px] tabular-nums">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-[#ff5a1f]" />
      <p className="mt-1 text-[12px] text-ash">{hint}</p>
    </div>
  );
}

export function Settings() {
  const { data, refresh } = useApi<{ settings: S }>("/api/settings");
  const [saving, setSaving] = useState(false);
  if (!data) return <Loading />;
  const s = data.settings;
  const save = async (patch: Partial<S>) => {
    setSaving(true);
    try {
      await post("/api/settings", patch);
      await refresh();
    } finally {
      setSaving(false);
    }
  };
  const plays = Object.keys(s.autonomy) as Exclude<PlayKey, "negotiated">[];

  return (
    <div className={page}>
      <PageHeader eyebrow="Workspace" title="Settings" subtitle="The rules Clutch works inside. Guardrails are enforced in the deal desk code — no prompt, call or email can talk its way past them." actions={<Mono>{saving ? "saving…" : "saved"}</Mono>} />

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-5 xl:col-span-5">
          <Panel title="Deal desk guardrails">
            <div className="space-y-6">
              <Slider label="Maximum discount" value={Math.round(s.maxDiscount * 100)} min={0} max={30} step={1} fmt={(v) => `${v}%`} onChange={(v) => save({ maxDiscount: v / 100 })} hint="Hard ceiling. Nothing above this is ever offered — not by the agent, not by autopilot." />
              <Slider label="Needs approval above" value={Math.round(s.approvalAbove * 100)} min={0} max={Math.round(s.maxDiscount * 100)} step={1} fmt={(v) => `${v}%`} onChange={(v) => save({ approvalAbove: v / 100 })} hint="Above this, Clutch pauses and asks you in the Inbox (or live, mid-call)." />
            </div>
            <div className="mt-6">
              <Mono>The ladder the agent climbs · one step per customer turn</Mono>
              <ul className="mt-2 divide-y divide-line/70 rounded-xl border border-line">
                {LADDER.map((r) => {
                  const blocked = r.d > s.maxDiscount + 1e-9;
                  const ask = !blocked && r.d > s.approvalAbove + 1e-9;
                  return (
                    <li key={r.d} className="flex items-center justify-between px-3 py-2 text-[13px]">
                      <span className={`font-mono tabular-nums ${blocked ? "text-ash line-through" : ""}`}>
                        {Math.round(r.d * 100)}% · {r.t} mo
                      </span>
                      <span className={`font-mono text-[10.5px] uppercase tracking-[0.12em] ${blocked ? "text-ash" : ask ? "text-signal" : "text-volt"}`}>{blocked ? "blocked" : ask ? "needs your ok" : "agent may offer"}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Panel>

          <Panel title="Inbox & autopilot">
            <div className="space-y-6">
              <label className="flex cursor-pointer items-start justify-between gap-4">
                <span>
                  <span className="block text-[14px]">Auto-handle customer replies</span>
                  <span className="block text-[12px] text-ash">Clutch reads, acts and answers new replies the moment they arrive. Off: they wait for your click.</span>
                </span>
                <button onClick={() => save({ autoReplies: !s.autoReplies })} className={`relative mt-1 h-5 w-9 shrink-0 rounded-full transition ${s.autoReplies ? "bg-volt" : "bg-line"}`} aria-pressed={s.autoReplies} aria-label="Auto-handle replies">
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-all ${s.autoReplies ? "left-[18px]" : "left-0.5"}`} />
                </button>
              </label>
              <Slider label="Autopilot batch size" value={s.autopilotLimit} min={1} max={30} step={1} fmt={(v) => `${v} accounts`} onChange={(v) => save({ autopilotLimit: v })} hint="Each autopilot run works the accounts with the most revenue at stake, highest first." />
            </div>
          </Panel>

          <Panel title="Team & approvers">
            <ul className="space-y-3">
              {[
                ["Meera Kapoor", "CSM lead · you", "Approves discounts up to the max"],
                ["Arjun Rao", "CEO", "Exec sponsor for re-thread intros"],
                ["Kabir Shah", "Finance", "Copied on order forms"],
              ].map(([n, r, d]) => (
                <li key={n} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-bone text-[11px] font-semibold text-ink">
                    {n
                      .split(" ")
                      .map((w) => w[0])
                      .join("")}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px]">
                      {n} <span className="text-ash">· {r}</span>
                    </span>
                    <span className="block text-[12px] text-ash">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel className="min-w-0 xl:col-span-7" title="Autonomy · how much each play may do on its own" pad={false}>
          <ul>
            {plays.map((k) => (
              <li key={k} className="grid items-center gap-3 border-b border-line px-5 py-4 last:border-0 md:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="text-[14.5px] font-medium">{PLAYBOOK[k].title}</div>
                  <div className="text-[12px] text-ash">
                    {PLAYBOOK[k].trigger} · {PLAYBOOK[k].steps.length} steps{PLAYBOOK[k].steps.some((x) => x.human) ? " · has human checkpoints" : ""}
                  </div>
                </div>
                <div className="flex rounded-full border border-line p-0.5">
                  {MODES.map((m) => (
                    <button
                      key={m.k}
                      title={m.hint}
                      onClick={() => save({ autonomy: { ...s.autonomy, [k]: m.k } })}
                      className={`rounded-full px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] transition ${s.autonomy[k] === m.k ? (m.k === "auto" ? "bg-volt text-ink" : m.k === "ask" ? "bg-bone text-ink" : "bg-line text-bone") : "text-ash hover:text-bone"}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <p className="px-5 py-4 text-[12px] leading-relaxed text-ash">
            Even on Autopilot, plays stop at their human checkpoints: a signature, a card update, or a discount above your approval line. “Ask me” plays land in the Inbox with the reason Clutch picked them.
          </p>
        </Panel>
      </div>
    </div>
  );
}
