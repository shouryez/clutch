"use client";

import type { Artifact } from "@/lib/types";
import { Loading, type State } from "./CommandCenter";
import { useApi } from "./live";
import { Mono, page, PageHeader } from "./ui";

type Item = { key: string; name: string; role: string; does: string[]; without: string; env: string; count?: (a: Artifact[]) => number; countLabel?: string };

const LIST: Item[] = [
  {
    key: "sarvam",
    name: "Sarvam AI",
    role: "Voice + brain",
    does: ["Saaras v4 turns the customer's speech (English or Hinglish) into text", "sarvam-105b runs the negotiation agent and Ask Clutch", "Bulbul v4 speaks the replies and the morning brief"],
    without: "Calls fall back to the browser's own speech engine; the agent falls back to Gemini.",
    env: "SARVAM_API_KEY",
  },
  { key: "gemini", name: "Google Gemini", role: "Backup brain", does: ["Takes over the agent if Sarvam is slow or down"], without: "A rules engine still negotiates inside the same guardrails.", env: "GEMINI_API_KEY" },
  {
    key: "email",
    name: "Resend",
    role: "Email",
    does: ["Sends order forms, ETAs, intros, fix-shipped notes and training offers", "Every email is also saved to the Outbox"],
    without: "Emails are written in full and logged to the Outbox, not delivered.",
    env: "RESEND_API_KEY",
    count: (a) => a.filter((x) => x.kind === "email").length,
    countLabel: "emails written",
  },
  {
    key: "github",
    name: "GitHub",
    role: "Engineering",
    does: ["Files P0 issues with the ARR at stake from the bug radar and plays", "Issue closed → Clutch tells every affected customer"],
    without: "Issues are drafted and tracked in Clutch with a sandbox number.",
    env: "GITHUB_TOKEN + GITHUB_REPO",
    count: (a) => a.filter((x) => x.kind === "issue").length,
    countLabel: "issues filed",
  },
  {
    key: "slack",
    name: "Slack",
    role: "Team alerts",
    does: ["Posts renewals, saves and escalations to #renewals", "Manager approvals for discounts over 10%"],
    without: "Posts are logged to the Outbox; approvals happen in the deal room.",
    env: "SLACK_WEBHOOK_URL",
    count: (a) => a.filter((x) => x.kind === "slack").length,
    countLabel: "posts",
  },
  {
    key: "stripe",
    name: "Stripe",
    role: "Billing",
    does: ["Updates seats, price and term when a renewal is signed", "Sends payment links and retries failed invoices"],
    without: "The subscription change is applied to Clutch's records and logged as a billing change.",
    env: "STRIPE_SECRET_KEY",
    count: (a) => a.filter((x) => x.kind === "billing").length,
    countLabel: "billing changes",
  },
  { key: "documenso", name: "Documenso", role: "E-signature", does: ["Open-source e-sign for renewal order forms", "The signature webhook moves the play to billing"], without: "Clutch's own signing page (/sign) collects a drawn signature.", env: "DOCUMENSO_API_KEY" },
];

export function Integrations() {
  const { data } = useApi<State>("/api/state");
  const { data: ob } = useApi<{ artifacts: Artifact[] }>("/api/outbox");
  if (!data) return <Loading />;
  const st = data.integrations as Record<string, boolean>;
  const arts = ob?.artifacts ?? [];
  const live = LIST.filter((i) => st[i.key]).length;
  return (
    <div className={page}>
      <PageHeader eyebrow="Automation" title="Integrations" subtitle="Clutch does its work in the tools you already use. Each one sits behind a single adapter, so a missing key never breaks a play." actions={<Mono>{live}/{LIST.length} live</Mono>} />

      <section className="mt-5 grid gap-3 rounded-2xl border border-line bg-carbon p-5 md:grid-cols-3">
        <div>
          <Mono className="text-volt">● Live</Mono>
          <p className="mt-1.5 text-[13px] leading-relaxed text-bone/80">The key is set. Clutch calls the real API: the email is delivered, the issue appears on GitHub.</p>
        </div>
        <div>
          <Mono>○ Sandbox</Mono>
          <p className="mt-1.5 text-[13px] leading-relaxed text-bone/80">No key. Clutch still writes the exact email, issue or billing change and logs it to the Outbox, so you can read everything it would have sent.</p>
        </div>
        <div>
          <Mono className="text-signal">Going live</Mono>
          <p className="mt-1.5 text-[13px] leading-relaxed text-bone/80">Add the key to <span className="font-mono text-[12px]">.env.local</span> and restart. The same play step goes live — nothing else changes.</p>
        </div>
      </section>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {LIST.map((i) => {
          const on = !!st[i.key];
          const n = i.count?.(arts);
          return (
            <div key={i.key} className={`flex flex-col justify-between gap-4 rounded-2xl border bg-carbon p-5 ${on ? "border-volt/30" : "border-line"}`}>
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-medium">{i.name}</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ash">{i.role}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${on ? "bg-volt/10 text-volt" : "border border-line text-ash"}`}>{on ? "● live" : "○ sandbox"}</span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {i.does.map((d) => (
                    <li key={d} className="flex gap-2 text-[13px] leading-snug text-bone/85">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ash" />
                      {d}
                    </li>
                  ))}
                </ul>
                {!on && <p className="mt-3 text-[12px] leading-snug text-ash">Without a key: {i.without}</p>}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                <span className="font-mono text-[10.5px] text-ash/80">{i.env}</span>
                {n !== undefined && (
                  <span className="font-mono text-[10.5px] text-bone">
                    {n} {i.countLabel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
