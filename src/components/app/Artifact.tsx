"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Fragment, useState, type ReactNode } from "react";
import type { Artifact, ArtifactKind } from "@/lib/types";
import { MailButton } from "./MailButton";
import { Mono, timeAgo } from "./ui";

export const KIND_LABEL: Record<ArtifactKind, string> = {
  email: "Email",
  issue: "GitHub issue",
  slack: "Slack",
  quote: "Quote",
  meeting: "Meeting",
  billing: "Billing change",
  research: "Research",
  analysis: "Analysis",
};

const SANDBOX_HINT: Partial<Record<ArtifactKind, string>> = {
  email: "Written and logged here. Add RESEND_API_KEY to deliver it.",
  issue: "Add GITHUB_TOKEN + GITHUB_REPO to file it on GitHub.",
  slack: "Add SLACK_WEBHOOK_URL to post it.",
  billing: "Add STRIPE_SECRET_KEY to apply it in Stripe test mode.",
  meeting: "Calendar booking runs in sandbox.",
  research: "Cached pricing snapshot.",
};

/** Turn in-app paths and URLs inside plain text into links. */
function linkify(text: string) {
  const parts = text.split(/(\s|^)(\/(?:sign|value|call|app)\/[\w\-/]+|https?:\/\/\S+)/g);
  return parts.map((p, i) =>
    /^(\/(sign|value|call|app)\/|https?:)/.test(p) ? (
      <a key={i} href={p} target="_blank" className="text-signal underline underline-offset-4">
        {p}
      </a>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

/** Tiny markdown for issue bodies: headings, tables, quotes, bold, italics. */
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!/^\|[-\s|]+\|$/.test(lines[i])) rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim()));
        i++;
      }
      i--;
      out.push(
        <table key={i} className="my-2 w-full text-left text-[12px]">
          <tbody>
            {rows.map((r, j) => (
              <tr key={j} className={j === 0 ? "border-b border-line text-ash" : "border-b border-line/50"}>
                {r.map((c, k) => (
                  <td key={k} className="py-1 pr-3 font-mono tabular-nums">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
    } else if (l.startsWith("## ")) out.push(<div key={i} className="mt-1 text-[15px] font-medium">{l.slice(3)}</div>);
    else if (l.startsWith("### ")) out.push(<div key={i} className="mt-3 text-[13px] font-medium">{l.slice(4)}</div>);
    else if (l.startsWith("> ")) out.push(<div key={i} className="my-1 border-l-2 border-line pl-3 text-[12.5px] italic text-bone/80">{l.slice(2)}</div>);
    else if (/^_.*_$/.test(l)) out.push(<div key={i} className="mt-2 text-[11.5px] italic text-ash">{l.slice(1, -1)}</div>);
    else if (l.trim()) out.push(<p key={i} className="text-[12.5px] text-bone/85">{l.replace(/\*\*/g, "")}</p>);
  }
  return <div>{out}</div>;
}

function Meta({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-3 divide-y divide-line/60 rounded-lg border border-line">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[minmax(110px,40%)_1fr] gap-3 px-3 py-1.5 text-[12px]">
          <dt className="text-ash">{k}</dt>
          <dd className="font-mono tabular-nums text-bone/90">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ModeChip({ a }: { a: Pick<Artifact, "mode" | "kind"> & { at?: number } }) {
  if (a.at === 0) return <span className="rounded-full border border-dashed border-line px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ash">draft</span>;
  return a.mode === "live" ? (
    <span className="rounded-full bg-volt/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-volt">{a.kind === "email" ? "delivered" : a.kind === "quote" || a.kind === "analysis" ? "computed" : "live"}</span>
  ) : (
    <span title={SANDBOX_HINT[a.kind]} className="rounded-full border border-line px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ash">
      sandbox
    </span>
  );
}

export function ArtifactView({ a, showAccount }: { a: Artifact; showAccount?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-ink/60">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Mono className="text-bone">{KIND_LABEL[a.kind]}</Mono>
          {showAccount && a.accountName && (
            <Link href={`/app/accounts/${a.accountId}`} className="truncate font-mono text-[10.5px] uppercase tracking-[0.12em] text-ash hover:text-bone">
              · {a.accountName}
            </Link>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {a.at ? <MailButton artifactId={a.id} sent={a.sent ?? null} /> : null}
          <ModeChip a={a} />
          <span className="font-mono text-[10px] text-ash">{a.at ? timeAgo(a.at) : "draft"}</span>
        </div>
      </div>
      <div className="px-4 py-3">
        {a.kind === "email" ? (
          <>
            <div className="space-y-0.5 text-[12px]">
              <div>
                <span className="inline-block w-14 text-ash">From</span>Meera Kapoor via Clutch
              </div>
              <div className="truncate">
                <span className="inline-block w-14 text-ash">To</span>
                {a.to}
              </div>
              <div>
                <span className="inline-block w-14 text-ash">Subject</span>
                <span className="font-medium">{a.title}</span>
              </div>
            </div>
            <pre className="mt-3 whitespace-pre-wrap border-t border-line pt-3 font-sans text-[12.5px] leading-relaxed text-bone/85">{linkify(a.body)}</pre>
          </>
        ) : a.kind === "slack" ? (
          <div className="flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-signal font-semibold text-ink">c</span>
            <div>
              <div className="text-[12.5px]">
                <span className="font-medium">Clutch</span> <span className="rounded bg-line px-1 font-mono text-[9px] text-ash">APP</span> <span className="text-ash">in {a.to}</span>
              </div>
              <p className="mt-0.5 text-[13px] text-bone/90">{a.body}</p>
            </div>
          </div>
        ) : a.kind === "issue" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-medium">{a.title}</span>
              <span className="text-[11px] text-ash">in {a.to}</span>
            </div>
            <div className="mt-2 rounded-lg border border-line p-3">
              <Markdown text={a.body} />
            </div>
            {a.meta && <Meta rows={a.meta} />}
          </>
        ) : (
          <>
            <div className="text-[13.5px] font-medium">{a.title}</div>
            {a.to && <div className="text-[11.5px] text-ash">{a.to}</div>}
            <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-bone/85">{linkify(a.body)}</p>
            {a.meta && <Meta rows={a.meta} />}
          </>
        )}
        {a.link && a.kind !== "email" && (
          <a href={a.link} target="_blank" className="mt-3 inline-block font-mono text-[11px] text-signal underline underline-offset-4">
            open {a.link.startsWith("/value") ? "value receipt" : a.link.startsWith("/app/radar") ? "bug radar" : "link"} ↗
          </a>
        )}
      </div>
    </div>
  );
}

/** Inline "view what it wrote" toggle for a play step. */
export function ArtifactPeek({ artifact }: { artifact?: Artifact }) {
  const [open, setOpen] = useState(false);
  if (!artifact) return null;
  return (
    <div className="mt-1.5">
      <button onClick={() => setOpen((x) => !x)} className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-bone/80 underline decoration-line underline-offset-4 hover:text-bone">
        {open ? "hide" : `view ${KIND_LABEL[artifact.kind].toLowerCase()}`} {open ? "↑" : "↓"}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-2">
              <ArtifactView a={artifact} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
