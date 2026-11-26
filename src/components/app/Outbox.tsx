"use client";

import { useState } from "react";
import type { Artifact, ArtifactKind } from "@/lib/types";
import { ArtifactView, KIND_LABEL } from "./Artifact";
import { Loading } from "./CommandCenter";
import { useApi } from "./live";
import { Mono, page, PageHeader, Panel, timeAgo } from "./ui";

const KINDS: (ArtifactKind | "all")[] = ["all", "email", "quote", "issue", "billing", "meeting", "research", "analysis", "slack"];

export function Outbox() {
  const { data } = useApi<{ artifacts: Artifact[] }>("/api/outbox");
  const [k, setK] = useState<ArtifactKind | "all">("all");
  const [sel, setSel] = useState<string | null>(null);
  if (!data) return <Loading />;
  const list = data.artifacts.filter((a) => k === "all" || a.kind === k);
  const cur = list.find((a) => a.id === sel) ?? list[0];
  const count = (x: ArtifactKind) => data.artifacts.filter((a) => a.kind === x).length;
  const sandbox = data.artifacts.filter((a) => a.mode === "mock" && ["email", "issue", "slack", "billing"].includes(a.kind)).length;

  return (
    <div className={page}>
      <PageHeader
        eyebrow="Automation"
        title="Outbox"
        subtitle="Every email Clutch wrote, every quote it priced, every issue it filed and every billing change it made — the full audit trail of the automation, newest first."
        actions={<Mono>{data.artifacts.length} items · {sandbox} in sandbox</Mono>}
      />
      <div className="mt-5 flex flex-wrap gap-2">
        {KINDS.map((x) => (
          <button
            key={x}
            onClick={() => setK(x)}
            className={`rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition ${k === x ? "bg-bone text-ink" : "border border-line text-ash hover:text-bone"}`}
          >
            {x === "all" ? `all · ${data.artifacts.length}` : `${KIND_LABEL[x]} · ${count(x)}`}
          </button>
        ))}
      </div>

      {!data.artifacts.length ? (
        <div className="mt-6 rounded-2xl border border-line bg-carbon p-10 text-center">
          <div className="text-[18px] font-medium tracking-[-0.02em]">Nothing sent yet.</div>
          <p className="mx-auto mt-2 max-w-md text-[13px] text-ash">Run a play or autopilot from the command center. Every email, quote, issue and billing change it produces lands here, readable in full.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-5 lg:grid-cols-12">
          <Panel className="min-w-0 lg:col-span-5" pad={false} title={`${list.length} items`}>
            <ul className="max-h-[70vh] overflow-y-auto">
              {list.map((a) => (
                <li key={a.id}>
                  <button onClick={() => setSel(a.id)} className={`grid w-full grid-cols-[84px_1fr_auto] items-baseline gap-3 border-b border-line px-4 py-3 text-left transition ${cur?.id === a.id ? "bg-ink/70" : "hover:bg-ink/40"}`}>
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ash">{KIND_LABEL[a.kind]}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px]">{a.title}</span>
                      <span className="block truncate text-[11.5px] text-ash">{a.accountName ?? a.to ?? "portfolio"}</span>
                    </span>
                    <span className="font-mono text-[10px] text-ash">{timeAgo(a.at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          <div className="min-w-0 lg:col-span-7">{cur && <ArtifactView a={cur} showAccount />}</div>
        </div>
      )}
      <p className="mt-6 max-w-3xl text-[12px] leading-relaxed text-ash">
        <span className="text-bone">Delivered</span> means the external system accepted it. <span className="text-bone">Sandbox</span> means the integration key isn’t set, so Clutch wrote it and logged it here instead of sending — add the key on the Integrations page and the same step goes live with no other change.
      </p>
    </div>
  );
}
