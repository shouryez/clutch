"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  fmtValue,
  NO_VALUE,
  OP_LABEL,
  opsFor,
  parseAmount,
  PLAY_OPTIONS,
  type FieldDef,
  type Op,
} from "@/lib/policy/catalog";
import { FUNCTION_NAMES } from "@/lib/policy/expr";
import {
  ACTION_LABEL,
  ACTIONS,
  CATEGORIES,
  SEVERITIES,
  type ActionType,
  type Category,
  type Rule,
  type Scope,
  type Severity,
  type When,
  type WhenItem,
} from "@/lib/policy/schema";
import type { Template } from "@/lib/policy/templates";
import { PLAY_LABEL } from "./plays";
import { I } from "./icons";
import { post } from "./live";
import { Btn, Mono } from "./ui";

export const SEV_STYLE: Record<Severity, string> = {
  critical: "bg-signal text-ink",
  high: "bg-signal/15 text-signal",
  medium: "bg-bone/10 text-bone",
  low: "bg-line text-ash",
};
export const CAT_LABEL: Record<Category, string> = {
  business: "Business",
  financial: "Financial",
  compliance: "Compliance",
};

type Cond = { field: string; op: Op; value: string; value2: string };
export type Draft = {
  id: string;
  name: string;
  description: string;
  category: Category;
  severity: Severity;
  scope: Scope;
  enabled: boolean;
  mode: "builder" | "formula";
  match: "all" | "any";
  conds: Cond[];
  formula: string;
  message: string;
  action: ActionType;
  play: string;
  owner: string;
};

type Issue = { path: string; message: string; line?: number };
type Preview =
  | { ok: false; issues: Issue[] }
  | {
      ok: true;
      text: string;
      checked: number;
      ms: number;
      count: number;
      arr: number;
      newVsAudit: number;
      matches: {
        accountId: string;
        accountName: string;
        arr: number;
        message: string;
        evidence: {
          field: string;
          label: string;
          actual: string;
          test: string;
        }[];
        offer?: string;
      }[];
    };

const isGroup = (x: WhenItem): x is When =>
  typeof x === "object" &&
  x !== null &&
  ("all" in x || "any" in x || "not" in x || "expr" in x);
const q = (v: unknown) =>
  typeof v === "number" || typeof v === "boolean"
    ? String(v)
    : JSON.stringify(String(v));
const ref = (v: unknown) =>
  v && typeof v === "object" && !Array.isArray(v) && "field" in (v as object)
    ? String((v as { field: string }).field)
    : null;

/** Any rule condition → the equivalent formula (so nothing is lost switching modes). */
export function toFormula(w: When): string {
  if (w.expr !== undefined) return w.expr;
  if (w.not)
    return `!(${isGroup(w.not) ? toFormula(w.not) : toFormula({ all: [w.not] })})`;
  const items = w.any ?? w.all ?? [];
  const parts = items.map((it) => {
    if (isGroup(it)) return `(${toFormula(it)})`;
    const c = it as { field: string; op: Op; value?: unknown };
    const v =
      ref(c.value) ??
      (Array.isArray(c.value) ? `[${c.value.map(q).join(", ")}]` : q(c.value));
    switch (c.op) {
      case "eq":
        return `${c.field} == ${v}`;
      case "neq":
        return `${c.field} != ${v}`;
      case "gt":
        return `${c.field} > ${v}`;
      case "gte":
        return `${c.field} >= ${v}`;
      case "lt":
        return `${c.field} < ${v}`;
      case "lte":
        return `${c.field} <= ${v}`;
      case "between": {
        const [a, b] = (c.value as unknown[]) ?? [];
        return `between(${c.field}, ${q(a)}, ${q(b)})`;
      }
      case "in":
        return `${c.field} in ${v}`;
      case "not_in":
        return `!(${c.field} in ${v})`;
      case "contains":
        return `contains(${c.field}, ${v})`;
      case "not_contains":
        return `!contains(${c.field}, ${v})`;
      case "matches":
        return `matches(${c.field}, ${v})`;
      case "is_true":
        return c.field;
      case "is_false":
        return `!${c.field}`;
      case "is_empty":
        return `isEmpty(${c.field})`;
      case "not_empty":
        return `!isEmpty(${c.field})`;
    }
    return "";
  });
  return parts.join(w.any ? " || " : " && ");
}

const flat = (w: When) =>
  !w.expr && !w.not && (w.all ?? w.any ?? []).every((x) => !isGroup(x));

export function draftFrom(r: Partial<Rule> & Record<string, unknown>): Draft {
  const when = (typeof r.when === "string"
    ? { expr: r.when }
    : (r.when as When)) ?? { all: [] };
  const builder = flat(when);
  const action = (typeof r.action === "string"
    ? { type: r.action }
    : (r.action as Rule["action"] | undefined)) ?? { type: "flag" };
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    description: String(r.description ?? ""),
    category: (r.category as Category) ?? "business",
    severity: (r.severity as Severity) ?? "medium",
    scope: (r.scope as Scope) ?? "account",
    enabled: r.enabled !== false,
    mode: builder ? "builder" : "formula",
    match: when.any ? "any" : "all",
    conds: builder
      ? (when.any ?? when.all ?? []).map((c) => {
          const x = c as { field: string; op: Op; value?: unknown };
          const v = x.value;
          return {
            field: x.field,
            op: x.op,
            value:
              ref(v) ??
              (Array.isArray(v)
                ? x.op === "between"
                  ? String(v[0])
                  : v.join(", ")
                : v === undefined
                  ? ""
                  : String(v)),
            value2: x.op === "between" && Array.isArray(v) ? String(v[1]) : "",
          };
        })
      : [],
    formula: builder ? "" : toFormula(when),
    message: String(r.message ?? ""),
    action: action.type as ActionType,
    play: action.play ?? "champion",
    owner: String(r.owner ?? ""),
  };
}

function condToRule(c: Cond, f: FieldDef | undefined): Record<string, unknown> {
  if (NO_VALUE.includes(c.op)) return { field: c.field, op: c.op };
  if (c.op === "between")
    return {
      field: c.field,
      op: c.op,
      value: [
        parseAmount(c.value) ?? c.value,
        parseAmount(c.value2) ?? c.value2,
      ],
    };
  if (c.op === "in" || c.op === "not_in")
    return {
      field: c.field,
      op: c.op,
      value: c.value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  return {
    field: c.field,
    op: c.op,
    value:
      f && ["money", "number", "percent", "days"].includes(f.type)
        ? c.value.trim()
        : c.value,
  };
}

export function ruleFrom(d: Draft, fields: Record<string, FieldDef>) {
  const when =
    d.mode === "formula"
      ? d.formula
      : { [d.match]: d.conds.map((c) => condToRule(c, fields[c.field])) };
  return {
    id: d.id.trim(),
    name: d.name.trim(),
    ...(d.description.trim() ? { description: d.description.trim() } : {}),
    category: d.category,
    severity: d.severity,
    scope: d.scope,
    enabled: d.enabled,
    when,
    message: d.message.trim() || d.name.trim(),
    action:
      d.action === "start_play" ? { type: d.action, play: d.play } : d.action,
    ...(d.owner.trim() ? { owner: d.owner.trim() } : {}),
  };
}

const PREFIX: Record<Category, string> = {
  business: "BIZ",
  financial: "FIN",
  compliance: "COMP",
};
export function nextId(cat: Category, taken: string[]) {
  const nums = taken
    .filter((t) => t.startsWith(PREFIX[cat] + "-"))
    .map((t) => Number(t.split("-")[1]) || 0);
  return `${PREFIX[cat]}-${String(Math.max(0, ...nums) + 1).padStart(3, "0")}`;
}

export function blankDraft(taken: string[]): Draft {
  return draftFrom({
    id: nextId("business", taken),
    name: "",
    category: "business",
    severity: "medium",
    scope: "account",
    when: { all: [{ field: "risk", op: "gte", value: 60 }] },
    message: "",
    action: { type: "flag" },
  });
}

function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
  tone,
}: {
  value: T;
  options: { k: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  tone?: (k: T) => string;
}) {
  return (
    <div>
      <Mono>{label}</Mono>
      <div className="mt-1.5 flex flex-wrap gap-1 rounded-xl border border-line bg-ink/60 p-1">
        {options.map((o) => (
          <button
            key={o.k}
            type="button"
            onClick={() => onChange(o.k)}
            className={`flex-1 rounded-lg px-2.5 py-1.5 text-[12.5px] transition ${value === o.k ? (tone?.(o.k) ?? "bg-bone text-ink") : "text-ash hover:text-bone"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const input =
  "w-full rounded-lg border border-line bg-ink/70 px-3 py-2 text-[13.5px] outline-none transition placeholder:text-ash/60 focus:border-ash";

function ValueInput({
  f,
  c,
  set,
}: {
  f?: FieldDef;
  c: Cond;
  set: (p: Partial<Cond>) => void;
}) {
  if (!f || NO_VALUE.includes(c.op))
    return <div className="flex items-center px-1 text-[12px] text-ash">—</div>;
  const unit =
    f.type === "money"
      ? "₹ · 25L, 1.2Cr"
      : f.type === "percent"
        ? "%"
        : f.type === "days"
          ? "days"
          : f.unit;
  if (c.op === "between")
    return (
      <div className="flex items-center gap-1.5">
        <input
          className={input}
          value={c.value}
          placeholder="from"
          onChange={(e) => set({ value: e.target.value })}
        />
        <span className="text-ash">–</span>
        <input
          className={input}
          value={c.value2}
          placeholder="to"
          onChange={(e) => set({ value2: e.target.value })}
        />
      </div>
    );
  if (
    (f.type === "enum" || f.type === "list") &&
    f.options &&
    (c.op === "eq" ||
      c.op === "neq" ||
      c.op === "contains" ||
      c.op === "not_contains")
  )
    return (
      <select
        className={input}
        value={c.value}
        onChange={(e) => set({ value: e.target.value })}
      >
        <option value="">choose…</option>
        {f.options.filter(Boolean).map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  return (
    <div className="relative">
      <input
        className={`${input} ${unit ? "pr-20" : ""}`}
        value={c.value}
        placeholder={
          c.op === "in" || c.op === "not_in" ? "comma, separated" : "value"
        }
        onChange={(e) => set({ value: e.target.value })}
        list={f.options ? `opts-${f.key}` : undefined}
      />
      {f.options && (
        <datalist id={`opts-${f.key}`}>
          {f.options.filter(Boolean).map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
      {unit && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-ash">
          {unit}
        </span>
      )}
    </div>
  );
}

export function RuleEditor({
  initial,
  originalId,
  fields,
  templates,
  taken,
  onClose,
  onSaved,
}: {
  initial: Draft;
  originalId?: string;
  fields: FieldDef[];
  templates: Template[];
  taken: string[];
  onClose: () => void;
  onSaved: (opts: { audit: boolean; version: number; id: string }) => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [probe, setProbe] = useState({ discountPct: 0.12, termMonths: 12 });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<Issue[] | null>(null);
  const formulaRef = useRef<HTMLTextAreaElement>(null);
  const F = useMemo(
    () =>
      Object.fromEntries(fields.map((f) => [f.key, f])) as Record<
        string,
        FieldDef
      >,
    [fields],
  );
  const scoped = fields.filter(
    (f) => d.scope === "deal" || f.scope === "account",
  );
  const groups = [...new Set(scoped.map((f) => f.group))];
  const set = (p: Partial<Draft>) => {
    setSaveErr(null);
    setD((x) => ({ ...x, ...p }));
  };
  const setCond = (i: number, p: Partial<Cond>) =>
    set({ conds: d.conds.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const isNew = originalId === undefined;

  // live dry-run, debounced
  const payload = JSON.stringify({
    rule: ruleFrom(d, F),
    probe: d.scope === "deal" ? probe : undefined,
  });
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/policies/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
        });
        setPreview((await r.json()) as Preview);
      } catch {
        /* keep last */
      }
    }, 260);
    return () => clearTimeout(t);
  }, [payload]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const applyTemplate = (t: Template) => {
    const x = draftFrom(t.rule as Partial<Rule> & Record<string, unknown>);
    if (taken.includes(x.id)) x.id = nextId(x.category, taken);
    setD(x);
  };

  const save = async (audit: boolean) => {
    setSaving(true);
    setSaveErr(null);
    try {
      const r = await fetch("/api/policies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          rule: ruleFrom(d, F),
          originalId,
        }),
      });
      const j = (await r.json()) as {
        ok: boolean;
        issues?: Issue[];
        version?: number;
      };
      if (!j.ok) {
        setSaveErr(j.issues ?? [{ path: "", message: "could not save" }]);
        return;
      }
      if (audit) await post("/api/audit");
      onSaved({ audit, version: j.version ?? 0, id: d.id });
    } finally {
      setSaving(false);
    }
  };

  const insert = (s: string) => {
    const el = formulaRef.current;
    if (!el) return set({ formula: d.formula + s });
    const a = el.selectionStart ?? d.formula.length;
    const b = el.selectionEnd ?? a;
    const next = d.formula.slice(0, a) + s + d.formula.slice(b);
    set({ formula: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + s.length, a + s.length);
    });
  };

  const issues = saveErr ?? (preview && !preview.ok ? preview.issues : []);
  const actions = ACTIONS[d.scope];
  const fmtArr = (n: number) => fmtValue(n, "money");

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="bg"
        className="fixed inset-0 z-[80] bg-ink/70 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        key="panel"
        role="dialog"
        aria-label="Rule editor"
        className="fixed inset-y-0 right-0 z-[81] flex w-full max-w-[1080px] flex-col border-l border-line bg-[#10100f] shadow-2xl"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <Mono>
              {isNew
                ? "New policy · no code, no redeploy"
                : `Edit ${originalId}`}
            </Mono>
            <h2 className="mt-1 text-[22px] font-medium tracking-[-0.03em]">
              {d.name || (isNew ? "Untitled rule" : originalId)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-line p-1.5 text-ash hover:text-bone"
            aria-label="Close"
          >
            <I.close width={16} height={16} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* ---------- form ---------- */}
          <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5">
            {isNew && (
              <div>
                <Mono>Start from a template — or build from scratch below</Mono>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {templates.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      title={t.blurb}
                      className="rounded-full border border-line px-3 py-1 text-[12px] text-ash transition hover:border-signal/60 hover:text-bone"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
              <label className="block">
                <Mono>ID</Mono>
                <input
                  data-testid="rule-id"
                  className={`${input} mt-1.5 font-mono`}
                  value={d.id}
                  onChange={(e) =>
                    set({
                      id: e.target.value.toUpperCase().replace(/\s/g, "-"),
                    })
                  }
                />
              </label>
              <label className="block">
                <Mono>Rule name</Mono>
                <input
                  data-testid="rule-name"
                  className={`${input} mt-1.5`}
                  value={d.name}
                  placeholder="e.g. Retail accounts at risk"
                  onChange={(e) => set({ name: e.target.value })}
                  autoFocus={isNew}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Seg
                label="Category"
                value={d.category}
                options={CATEGORIES.map((c) => ({ k: c, label: CAT_LABEL[c] }))}
                onChange={(category) =>
                  set({
                    category,
                    id:
                      isNew && /^(BIZ|FIN|COMP)-\d+$/.test(d.id)
                        ? nextId(category, taken)
                        : d.id,
                  })
                }
              />
              <Seg
                label="Severity"
                value={d.severity}
                options={SEVERITIES.map((s) => ({
                  k: s,
                  label: s[0].toUpperCase() + s.slice(1),
                }))}
                onChange={(severity) => set({ severity })}
                tone={(k) => SEV_STYLE[k]}
              />
              <Seg
                label="Applies to"
                value={d.scope}
                options={[
                  { k: "account" as Scope, label: "Accounts" },
                  { k: "deal" as Scope, label: "Deals & offers" },
                ]}
                onChange={(scope) =>
                  set({
                    scope,
                    action: ACTIONS[scope].includes(d.action)
                      ? d.action
                      : ACTIONS[scope][scope === "deal" ? 1 : 0],
                    conds:
                      scope === "account"
                        ? d.conds.filter((c) => F[c.field]?.scope !== "deal")
                        : d.conds,
                  })
                }
              />
            </div>

            {/* condition */}
            <div className="rounded-2xl border border-line bg-carbon/60">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Mono className="text-bone">When</Mono>
                  {d.mode === "builder" && (
                    <select
                      className="rounded-md border border-line bg-ink px-2 py-0.5 text-[12px]"
                      value={d.match}
                      onChange={(e) =>
                        set({ match: e.target.value as "all" | "any" })
                      }
                    >
                      <option value="all">ALL of these are true</option>
                      <option value="any">ANY of these is true</option>
                    </select>
                  )}
                </div>
                <div className="flex rounded-lg border border-line p-0.5 text-[11.5px]">
                  {(["builder", "formula"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        if (m === d.mode) return;
                        if (m === "formula")
                          set({
                            mode: m,
                            formula:
                              d.formula ||
                              toFormula({
                                [d.match]: d.conds.map((c) =>
                                  condToRule(c, F[c.field]),
                                ),
                              } as When),
                          });
                        else
                          set({
                            mode: m,
                            conds: d.conds.length
                              ? d.conds
                              : [
                                  {
                                    field: "risk",
                                    op: "gte",
                                    value: "60",
                                    value2: "",
                                  },
                                ],
                          });
                      }}
                      className={`rounded-md px-2.5 py-1 capitalize transition ${d.mode === m ? "bg-bone text-ink" : "text-ash hover:text-bone"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {d.mode === "builder" ? (
                <div className="space-y-2 p-3">
                  {d.conds.map((c, i) => {
                    const f = F[c.field];
                    const ops = f ? opsFor(f.type) : [];
                    return (
                      <div
                        key={i}
                        className="grid items-center gap-2 sm:grid-cols-[minmax(0,1.2fr)_130px_minmax(0,1fr)_28px]"
                      >
                        <select
                          aria-label="Field"
                          className={input}
                          value={c.field}
                          onChange={(e) => {
                            const nf = F[e.target.value];
                            const nops = nf ? opsFor(nf.type) : [];
                            setCond(i, {
                              field: e.target.value,
                              op: nops.includes(c.op) ? c.op : nops[0],
                              value: "",
                              value2: "",
                            });
                          }}
                        >
                          {groups.map((g) => (
                            <optgroup key={g} label={g}>
                              {scoped
                                .filter((x) => x.group === g)
                                .map((x) => (
                                  <option key={x.key} value={x.key}>
                                    {x.label}
                                  </option>
                                ))}
                            </optgroup>
                          ))}
                        </select>
                        <select
                          aria-label="Operator"
                          className={input}
                          value={c.op}
                          onChange={(e) =>
                            setCond(i, { op: e.target.value as Op })
                          }
                        >
                          {ops.map((o) => (
                            <option key={o} value={o}>
                              {OP_LABEL[o]}
                            </option>
                          ))}
                        </select>
                        <ValueInput f={f} c={c} set={(p) => setCond(i, p)} />
                        <button
                          type="button"
                          aria-label="Remove condition"
                          onClick={() =>
                            set({ conds: d.conds.filter((_, j) => j !== i) })
                          }
                          className="grid h-7 w-7 place-items-center rounded-md text-ash hover:bg-line hover:text-bone"
                        >
                          <I.close width={13} height={13} />
                        </button>
                        {f && (
                          <div className="-mt-1 pl-1 text-[11px] text-ash/80 sm:col-span-4">
                            {f.description}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      set({
                        conds: [
                          ...d.conds,
                          {
                            field: d.scope === "deal" ? "discountPct" : "arr",
                            op: "gte",
                            value: "",
                            value2: "",
                          },
                        ],
                      })
                    }
                    className="rounded-lg border border-dashed border-line px-3 py-1.5 text-[12.5px] text-ash transition hover:border-ash hover:text-bone"
                  >
                    + Add condition
                  </button>
                </div>
              ) : (
                <div className="p-3">
                  <textarea
                    ref={formulaRef}
                    data-testid="rule-formula"
                    spellCheck={false}
                    rows={4}
                    className={`${input} font-mono text-[13px] leading-relaxed`}
                    value={d.formula}
                    placeholder={
                      'industry == "Retail" && risk > 50 && arr >= 10L'
                    }
                    onChange={(e) => set({ formula: e.target.value })}
                  />
                  <div className="mt-2 text-[11.5px] text-ash">
                    <span className="text-bone/80">Operators</span> == != &gt;
                    &gt;= &lt; &lt;= &amp;&amp; || ! in [..] ·{" "}
                    <span className="text-bone/80">money</span> 50k 10L 1.2Cr ·{" "}
                    <span className="text-bone/80">functions</span>{" "}
                    {FUNCTION_NAMES.join(", ")}
                  </div>
                  <div className="mt-2 flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                    {scoped.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        title={`${f.label} — ${f.description}`}
                        onClick={() => insert(f.key)}
                        className={`rounded-md border px-1.5 py-0.5 font-mono text-[11px] transition hover:text-bone ${f.scope === "deal" ? "border-signal/30 text-signal/80" : "border-line text-ash"}`}
                      >
                        {f.key}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <Mono>Then</Mono>
                <select
                  data-testid="rule-action"
                  className={`${input} mt-1.5`}
                  value={d.action}
                  onChange={(e) =>
                    set({ action: e.target.value as ActionType })
                  }
                >
                  {actions.map((a) => (
                    <option key={a} value={a}>
                      {ACTION_LABEL[a]}
                    </option>
                  ))}
                </select>
              </label>
              {d.action === "start_play" ? (
                <label className="block">
                  <Mono>Play to queue</Mono>
                  <select
                    className={`${input} mt-1.5`}
                    value={d.play}
                    onChange={(e) => set({ play: e.target.value })}
                  >
                    {PLAY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {PLAY_LABEL[p as keyof typeof PLAY_LABEL] ?? p}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="self-end pb-2 text-[12px] text-ash">
                  {d.action === "block"
                    ? "The deal desk refuses it — on calls, quotes and inbox re-quotes — and offers the best compliant terms."
                    : d.action === "require_approval"
                      ? "Clutch pauses the deal and asks a manager (live, mid-call)."
                      : d.action === "notify"
                        ? "Posts the exception to #renewals when it first appears."
                        : "Listed in the audit; nothing else happens."}
                </div>
              )}
            </div>

            <label className="block">
              <Mono>
                Message on the exception · {"{{field}}"} inserts a value
              </Mono>
              <input
                data-testid="rule-message"
                className={`${input} mt-1.5`}
                value={d.message}
                placeholder="{{name}} is {{risk}} risk with {{daysToRenewal}} to go"
                onChange={(e) => set({ message: e.target.value })}
              />
            </label>

            <details className="group rounded-xl border border-line/70 px-3 py-2 [&_summary::-webkit-details-marker]:hidden">
              <summary className="cursor-pointer list-none font-mono text-[10.5px] uppercase tracking-[0.14em] text-ash hover:text-bone">
                <span className="inline-block transition group-open:rotate-90">
                  ›
                </span>{" "}
                More options — reason, owner
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
                <label className="block">
                  <Mono>Why this rule exists (optional)</Mono>
                  <input
                    className={`${input} mt-1.5`}
                    value={d.description}
                    placeholder="e.g. Board mandate after Q3 healthcare losses"
                    onChange={(e) => set({ description: e.target.value })}
                  />
                </label>
                <label className="block">
                  <Mono>Owner</Mono>
                  <input
                    className={`${input} mt-1.5`}
                    value={d.owner}
                    placeholder="Finance"
                    onChange={(e) => set({ owner: e.target.value })}
                  />
                </label>
              </div>
            </details>
          </div>

          {/* ---------- live dry run ---------- */}
          <div className="flex min-h-0 flex-col border-t border-line bg-ink/40 lg:border-l lg:border-t-0">
            <div className="border-b border-line px-5 py-3.5">
              <div className="flex items-center justify-between">
                <Mono>Live dry-run · nothing saved</Mono>
                {preview?.ok && (
                  <span className="font-mono text-[10px] text-ash">
                    {preview.checked} checked · {preview.ms} ms
                  </span>
                )}
              </div>
              {d.scope === "deal" && (
                <div className="mt-3 rounded-xl border border-line p-3">
                  <div className="text-[12px] text-ash">
                    Test as if every account asked for…
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={20}
                      value={Math.round(probe.discountPct * 100)}
                      onChange={(e) =>
                        setProbe((p) => ({
                          ...p,
                          discountPct: Number(e.target.value) / 100,
                        }))
                      }
                      className="flex-1 accent-[#ff5a1f]"
                    />
                    <span className="w-10 font-mono text-[13px] tabular-nums">
                      {Math.round(probe.discountPct * 100)}%
                    </span>
                    <select
                      className="rounded-md border border-line bg-ink px-1.5 py-0.5 text-[12px]"
                      value={probe.termMonths}
                      onChange={(e) =>
                        setProbe((p) => ({
                          ...p,
                          termMonths: Number(e.target.value),
                        }))
                      }
                    >
                      {[12, 24, 36].map((t) => (
                        <option key={t} value={t}>
                          {t} mo
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {issues.length > 0 ? (
                <div data-testid="rule-issues" className="space-y-2">
                  <div className="text-[13px] text-signal">
                    Fix{" "}
                    {issues.length === 1 ? "this" : `these ${issues.length}`} to
                    save
                  </div>
                  {issues.map((x, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-signal/30 bg-signal/[0.06] px-3 py-2 text-[12.5px]"
                    >
                      <span className="font-mono text-[10.5px] text-ash">
                        {x.path.replace(/^rule\.?/, "") || "rule"}
                      </span>
                      <div className="text-bone/90">{x.message}</div>
                    </div>
                  ))}
                </div>
              ) : !preview || !preview.ok ? (
                <div className="text-[13px] text-ash">Checking…</div>
              ) : (
                <div data-testid="rule-preview">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-[44px] font-medium leading-none tracking-[-0.05em] tabular-nums ${preview.count ? "text-signal" : "text-volt"}`}
                    >
                      {preview.count}
                    </span>
                    <span className="text-[13px] text-ash">
                      {d.scope === "deal"
                        ? `of ${preview.checked} deals would be ${d.action === "block" ? "blocked" : d.action === "require_approval" ? "held for approval" : "flagged"}`
                        : `of ${preview.checked} accounts would be flagged`}
                    </span>
                  </div>
                  {preview.count > 0 && (
                    <div className="mt-1 text-[12.5px] text-ash">
                      {fmtArr(preview.arr)} ARR · {preview.newVsAudit} not in
                      the last audit
                    </div>
                  )}
                  <div className="mt-3 rounded-lg border border-line bg-ink/60 px-3 py-2 font-mono text-[11.5px] leading-relaxed text-bone/80">
                    {preview.text}
                  </div>
                  <ul className="mt-4 space-y-2">
                    {preview.matches.slice(0, 12).map((m) => (
                      <li
                        key={m.accountId}
                        className="rounded-xl border border-line bg-carbon/70 px-3 py-2.5"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13.5px]">
                            {m.accountName}
                          </span>
                          <span className="font-mono text-[11px] text-ash">
                            {fmtArr(m.arr)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[12px] text-ash">
                          {m.message}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {m.evidence.slice(0, 4).map((e) => (
                            <span
                              key={e.field}
                              className="rounded-md bg-line/70 px-1.5 py-0.5 font-mono text-[10.5px] text-bone/80"
                            >
                              {e.field} = {e.actual}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                    {preview.count > 12 && (
                      <li className="text-[12px] text-ash">
                        + {preview.count - 12} more
                      </li>
                    )}
                    {preview.count === 0 && (
                      <li className="text-[12.5px] text-ash">
                        Nothing in the book trips this rule right now. It still
                        runs on every future audit
                        {d.scope === "deal" ? " and every offer" : ""}.
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3.5">
              <Btn onClick={onClose}>Cancel</Btn>
              <Btn
                onClick={() => save(false)}
                disabled={saving || issues.length > 0}
              >
                Save
              </Btn>
              <Btn
                tone="primary"
                onClick={() => save(true)}
                disabled={saving || issues.length > 0}
              >
                {saving ? "Saving…" : "Save & re-run audit"}
              </Btn>
            </footer>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>,
    document.body,
  );
}
