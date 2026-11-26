/**
 * Policy rules are DATA. This module defines their shape, validates anything
 * that claims to be a rule (UI form, YAML/JSON file, API), and compiles it to
 * a matcher. Client-safe: the rule builder uses the same validator.
 */
import { FIELD, FIELDS, NO_VALUE, OP_ALIAS, opsFor, parseAmount, PLAY_OPTIONS, type FieldDef, type Op } from "./catalog";
import { evaluate, ExprError, parse, referenced, type Node, type Val } from "./expr";

export type Category = "business" | "financial" | "compliance";
export type Severity = "low" | "medium" | "high" | "critical";
export type Scope = "account" | "deal";
export type ActionType = "flag" | "notify" | "start_play" | "require_approval" | "block";

export type Condition = { field: string; op: Op; value?: unknown };
export type When = { all?: WhenItem[]; any?: WhenItem[]; not?: WhenItem; expr?: string };
export type WhenItem = Condition | When;

export type Rule = {
  id: string;
  name: string;
  description?: string;
  category: Category;
  severity: Severity;
  scope: Scope;
  enabled: boolean;
  when: When;
  message: string;
  action: { type: ActionType; play?: string };
  owner?: string;
  tags?: string[];
};

export const CATEGORIES: Category[] = ["business", "financial", "compliance"];
export const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];
export const SEV_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
export const ACTIONS: Record<Scope, ActionType[]> = { account: ["flag", "notify", "start_play"], deal: ["flag", "require_approval", "block"] };
export const ACTION_LABEL: Record<ActionType, string> = {
  flag: "Flag as exception",
  notify: "Flag + alert #renewals",
  start_play: "Flag + queue a play",
  require_approval: "Require manager approval",
  block: "Block the offer",
};

export type Issue = { path: string; message: string };

function lev(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1));
  return d[a.length][b.length];
}
export function suggest(word: string, pool: string[]) {
  const best = pool.map((p) => [p, lev(word, p)] as const).sort((x, y) => x[1] - y[1])[0];
  return best && best[1] <= Math.max(2, Math.floor(word.length / 3)) ? best[0] : null;
}
const hint = (w: string, pool: string[]) => {
  const s = suggest(w, pool);
  return s ? ` — did you mean "${s}"?` : "";
};
/** Unknown field: suggest within scope first, then a deal-only field with a nudge to switch scope. */
const fieldHint = (w: string, scope: Scope) => {
  const inScope = suggest(w, fieldsFor(scope).map((f) => f.key));
  if (inScope) return ` — did you mean "${inScope}"?`;
  const any = suggest(w, FIELDS.map((f) => f.key));
  return any ? ` — did you mean "${any}"? (a deal field: set scope to deal)` : "";
};

const isWhen = (x: WhenItem): x is When => typeof x === "object" && x !== null && ("all" in x || "any" in x || "not" in x || "expr" in x);

function fieldsFor(scope: Scope): FieldDef[] {
  return FIELDS.filter((f) => scope === "deal" || f.scope === "account");
}

/** Normalise a raw value (YAML "25L", "yes", numbers as strings) to the field's type. */
function coerce(f: FieldDef, v: unknown): unknown {
  if (v && typeof v === "object" && !Array.isArray(v) && "field" in (v as object)) return v; // field reference
  if (Array.isArray(v)) return v.map((x) => coerce(f, x));
  if (["money", "number", "percent", "days"].includes(f.type)) return parseAmount(v) ?? v;
  if (f.type === "boolean" && typeof v === "string") return /^(true|yes|y|1)$/i.test(v) ? true : /^(false|no|n|0)$/i.test(v) ? false : v;
  return v;
}

function checkCondition(c: Record<string, unknown>, scope: Scope, path: string, issues: Issue[]): Condition | null {
  const pool = fieldsFor(scope);
  const field = String(c.field ?? "");
  const f = FIELD[field];
  if (!field) {
    issues.push({ path: `${path}.field`, message: "missing field" });
    return null;
  }
  if (!f) {
    issues.push({ path: `${path}.field`, message: `unknown field "${field}"${fieldHint(field, scope)}` });
    return null;
  }
  if (f.scope === "deal" && scope === "account") {
    issues.push({ path: `${path}.field`, message: `"${field}" only exists on deals — set scope: deal` });
    return null;
  }
  const rawOp = String(c.op ?? (f.type === "boolean" ? "is_true" : "eq"));
  const op = (OP_ALIAS[rawOp.toLowerCase()] ?? rawOp) as Op;
  const allowed = opsFor(f.type);
  if (!allowed.includes(op)) {
    issues.push({ path: `${path}.op`, message: `"${rawOp}" doesn’t work on ${f.type} field "${field}" — use one of ${allowed.join(", ")}` });
    return null;
  }
  if (NO_VALUE.includes(op)) return { field, op };
  if (c.value === undefined || c.value === null || c.value === "") {
    issues.push({ path: `${path}.value`, message: `"${field} ${op}" needs a value` });
    return null;
  }
  const value = coerce(f, c.value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const ref = String((value as { field: unknown }).field);
    if (!pool.some((x) => x.key === ref)) issues.push({ path: `${path}.value.field`, message: `unknown field "${ref}"${hint(ref, pool.map((x) => x.key))}` });
    return { field, op, value };
  }
  const numeric = ["money", "number", "percent", "days"].includes(f.type);
  if (op === "between") {
    if (!Array.isArray(value) || value.length !== 2 || value.some((x) => typeof x !== "number")) {
      issues.push({ path: `${path}.value`, message: "between needs two numbers, e.g. [0, 30]" });
      return null;
    }
  } else if (op === "in" || op === "not_in") {
    if (!Array.isArray(value)) return { field, op, value: [value] };
  } else if (numeric && typeof value !== "number") {
    issues.push({ path: `${path}.value`, message: `"${String(c.value)}" isn’t a number (try 25L, 1.2Cr, 12)` });
    return null;
  }
  if (f.type === "enum" && f.options && f.key !== "industry") {
    for (const v of Array.isArray(value) ? value : [value]) {
      if (typeof v === "string" && v !== "" && !f.options.some((o) => o.toLowerCase() === v.toLowerCase()))
        issues.push({ path: `${path}.value`, message: `"${v}" isn’t a valid ${f.label.toLowerCase()}${hint(v, f.options)} (${f.options.filter(Boolean).join(", ")})` });
    }
  }
  if (op === "matches") {
    try {
      new RegExp(String(value));
    } catch {
      issues.push({ path: `${path}.value`, message: "invalid regular expression" });
    }
  }
  return { field, op, value };
}

function checkWhen(w: unknown, scope: Scope, path: string, issues: Issue[]): When | null {
  if (typeof w === "string") w = { expr: w };
  if (!w || typeof w !== "object" || Array.isArray(w)) {
    if (Array.isArray(w)) w = { all: w };
    else {
      issues.push({ path, message: "when must be a formula string or {all: [...]} / {any: [...]}" });
      return null;
    }
  }
  const o = w as Record<string, unknown>;
  if (typeof o.expr === "string") {
    const src = o.expr.trim();
    if (!src) {
      issues.push({ path: `${path}.expr`, message: "formula is empty" });
      return null;
    }
    try {
      const ast = parse(src);
      const pool = fieldsFor(scope);
      for (const name of referenced(ast)) {
        if (!pool.some((f) => f.key === name)) {
          const dealOnly = FIELD[name]?.scope === "deal";
          issues.push({ path: `${path}.expr`, message: dealOnly ? `"${name}" only exists on deals — set scope: deal` : `unknown field "${name}"${fieldHint(name, scope)}` });
        }
      }
    } catch (e) {
      const at = e instanceof ExprError ? e.at : 0;
      issues.push({ path: `${path}.expr`, message: `${(e as Error).message} (at character ${at + 1}: “${src.slice(Math.max(0, at - 8), at)}⟨here⟩${src.slice(at, at + 8)}”)` });
    }
    return { expr: src };
  }
  if ("field" in o) {
    const c = checkCondition(o, scope, path, issues);
    return c ? { all: [c] } : null;
  }
  const key = (["all", "any"] as const).find((k) => k in o);
  if (key) {
    const items = o[key];
    if (!Array.isArray(items) || items.length === 0) {
      issues.push({ path: `${path}.${key}`, message: `${key} needs at least one condition` });
      return null;
    }
    const out: WhenItem[] = [];
    items.forEach((it, i) => {
      const p = `${path}.${key}[${i}]`;
      if (typeof it === "string") {
        const sub = checkWhen({ expr: it }, scope, p, issues);
        if (sub) out.push(sub);
      } else if (it && typeof it === "object" && "field" in it) {
        const c = checkCondition(it as Record<string, unknown>, scope, p, issues);
        if (c) out.push(c);
      } else {
        const sub = checkWhen(it, scope, p, issues);
        if (sub) out.push(sub);
      }
    });
    return { [key]: out };
  }
  if ("not" in o) {
    const sub = checkWhen(o.not, scope, `${path}.not`, issues);
    return sub ? { not: sub } : null;
  }
  issues.push({ path, message: `expected all:, any:, not:, expr: or a single condition${hint(Object.keys(o)[0] ?? "", ["all", "any", "not", "expr"])}` });
  return null;
}

const ID_RE = /^[A-Za-z][A-Za-z0-9_-]{1,31}$/;

/** Validate + normalise one rule. Returns the clean rule and every problem found. */
export function checkRule(raw: unknown, path = "rule"): { rule: Rule | null; issues: Issue[] } {
  const issues: Issue[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { rule: null, issues: [{ path, message: "a rule must be an object with id, name, when, …" }] };
  const r = raw as Record<string, unknown>;
  const known = ["id", "name", "description", "category", "severity", "scope", "enabled", "when", "message", "action", "play", "owner", "tags"];
  for (const k of Object.keys(r)) if (!known.includes(k)) issues.push({ path: `${path}.${k}`, message: `unknown key "${k}"${hint(k, known)}` });

  const id = String(r.id ?? "").trim();
  if (!id) issues.push({ path: `${path}.id`, message: "missing id (e.g. FIN-004)" });
  else if (!ID_RE.test(id)) issues.push({ path: `${path}.id`, message: `id "${id}" must start with a letter and use only letters, digits, - or _` });
  const name = String(r.name ?? "").trim();
  if (!name) issues.push({ path: `${path}.name`, message: "missing name" });

  const category = String(r.category ?? "business").toLowerCase() as Category;
  if (!CATEGORIES.includes(category)) issues.push({ path: `${path}.category`, message: `category must be ${CATEGORIES.join(" | ")}${hint(category, CATEGORIES)}` });
  const severity = String(r.severity ?? "medium").toLowerCase() as Severity;
  if (!SEVERITIES.includes(severity)) issues.push({ path: `${path}.severity`, message: `severity must be ${SEVERITIES.join(" | ")}${hint(severity, SEVERITIES)}` });
  const scopeRaw = String(r.scope ?? "account").toLowerCase();
  const scope = (["deal", "deals", "offer", "offers", "quote"].includes(scopeRaw) ? "deal" : scopeRaw === "accounts" ? "account" : scopeRaw) as Scope;
  if (scope !== "account" && scope !== "deal") issues.push({ path: `${path}.scope`, message: `scope must be account | deal` });

  const enabled = r.enabled === undefined ? true : r.enabled === true || /^(true|yes|on)$/i.test(String(r.enabled));
  if (r.when === undefined) issues.push({ path: `${path}.when`, message: "missing when (the condition)" });
  const when = r.when === undefined ? null : checkWhen(r.when, scope === "deal" ? "deal" : "account", `${path}.when`, issues);

  let action: Rule["action"] = { type: scope === "deal" ? "require_approval" : "flag" };
  const ra = r.action;
  if (typeof ra === "string") action = { type: ra.toLowerCase().replace(/[\s-]/g, "_") as ActionType, play: typeof r.play === "string" ? r.play : undefined };
  else if (ra && typeof ra === "object") action = { type: String((ra as { type?: unknown }).type ?? "flag").toLowerCase() as ActionType, play: (ra as { play?: string }).play };
  const allowedActions = ACTIONS[scope === "deal" ? "deal" : "account"];
  if (!allowedActions.includes(action.type)) issues.push({ path: `${path}.action`, message: `action "${action.type}" isn’t available for ${scope} rules — use ${allowedActions.join(" | ")}` });
  if (action.type === "start_play") {
    if (!action.play) issues.push({ path: `${path}.action.play`, message: `start_play needs a play (${PLAY_OPTIONS.join(", ")})` });
    else if (!PLAY_OPTIONS.includes(action.play)) issues.push({ path: `${path}.action.play`, message: `unknown play "${action.play}"${hint(action.play, PLAY_OPTIONS)}` });
  } else delete action.play;

  const message = String(r.message ?? "").trim() || name;
  for (const m of message.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
    if (!FIELD[m[1]] && m[1] !== "rule") issues.push({ path: `${path}.message`, message: `template uses unknown field {{${m[1]}}}${hint(m[1], FIELDS.map((f) => f.key))}` });
  }
  const tags = Array.isArray(r.tags) ? r.tags.map(String) : typeof r.tags === "string" ? r.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined;

  if (issues.length || !when) return { rule: null, issues };
  const rule: Rule = { id, name, category, severity, scope, enabled, when, message, action };
  if (r.description) rule.description = String(r.description);
  if (r.owner) rule.owner = String(r.owner);
  if (tags?.length) rule.tags = tags;
  return { rule, issues };
}

/** Validate a whole document: { rules: [...] } or a bare list. */
export function checkDocument(doc: unknown): { rules: Rule[]; issues: Issue[]; revision?: number } {
  const issues: Issue[] = [];
  let list: unknown = doc;
  let revision: number | undefined;
  if (doc && typeof doc === "object" && !Array.isArray(doc)) {
    const d = doc as Record<string, unknown>;
    list = d.rules ?? d.policies;
    if (typeof d.revision === "number") revision = d.revision;
    for (const k of Object.keys(d)) if (!["rules", "policies", "revision", "version", "updated"].includes(k)) issues.push({ path: k, message: `unknown top-level key "${k}" (expected rules:)` });
  }
  if (doc === null || doc === undefined) return { rules: [], issues: [{ path: "", message: "file is empty — expected a rules: list" }] };
  if (!Array.isArray(list)) return { rules: [], issues: [{ path: "rules", message: "expected a rules: list" }] };
  const rules: Rule[] = [];
  const seen = new Set<string>();
  list.forEach((raw, i) => {
    const { rule, issues: is } = checkRule(raw, `rules[${i}]`);
    issues.push(...is);
    if (rule) {
      if (seen.has(rule.id.toLowerCase())) issues.push({ path: `rules[${i}].id`, message: `duplicate id "${rule.id}"` });
      seen.add(rule.id.toLowerCase());
      rules.push(rule);
    }
  });
  return { rules, issues, revision };
}

// ---------------------------------------------------------------- matching

export type Facts = Record<string, Val>;
export type Evidence = { field: string; label: string; actual: string; test: string };

const toNum = (v: unknown) => (typeof v === "number" ? v : Number(v));
const lower = (v: unknown) => String(v ?? "").toLowerCase();

function resolve(v: unknown, facts: Facts): unknown {
  if (v && typeof v === "object" && !Array.isArray(v) && "field" in (v as object)) return facts[String((v as { field: string }).field)];
  return v;
}

export function testCondition(c: Condition, facts: Facts): boolean {
  const a = facts[c.field];
  const b = resolve(c.value, facts);
  switch (c.op) {
    case "eq":
      return typeof a === "number" ? a === toNum(b) : lower(a) === lower(b);
    case "neq":
      return typeof a === "number" ? a !== toNum(b) : lower(a) !== lower(b);
    case "gt":
      return toNum(a) > toNum(b);
    case "gte":
      return toNum(a) >= toNum(b);
    case "lt":
      return toNum(a) < toNum(b);
    case "lte":
      return toNum(a) <= toNum(b);
    case "between": {
      const [lo, hi] = b as number[];
      return toNum(a) >= lo && toNum(a) <= hi;
    }
    case "in":
      return (b as unknown[]).some((x) => lower(x) === lower(a));
    case "not_in":
      return !(b as unknown[]).some((x) => lower(x) === lower(a));
    case "contains":
      return Array.isArray(a) ? a.some((x) => lower(x) === lower(b)) : lower(a).includes(lower(b));
    case "not_contains":
      return Array.isArray(a) ? !a.some((x) => lower(x) === lower(b)) : !lower(a).includes(lower(b));
    case "matches":
      try {
        return new RegExp(String(b), "i").test(String(a ?? ""));
      } catch {
        return false;
      }
    case "is_true":
      return a === true;
    case "is_false":
      return a === false;
    case "is_empty":
      return a === null || a === "" || (Array.isArray(a) && a.length === 0);
    case "not_empty":
      return !(a === null || a === "" || (Array.isArray(a) && a.length === 0));
  }
  return false;
}

export function describeTest(c: Condition, fmt: (v: unknown, key: string) => string) {
  const v = c.value && typeof c.value === "object" && !Array.isArray(c.value) && "field" in (c.value as object) ? String((c.value as { field: string }).field) : Array.isArray(c.value) ? (c.op === "between" ? c.value.map((x) => fmt(x, c.field)).join(" – ") : c.value.join(", ")) : fmt(c.value, c.field);
  const sym: Record<Op, string> = { eq: "=", neq: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤", between: "between", in: "in", not_in: "not in", contains: "∋", not_contains: "∌", matches: "~", is_true: "", is_false: "", is_empty: "empty", not_empty: "set" };
  if (c.op === "is_true") return "must be yes";
  if (c.op === "is_false") return "must be no";
  return `${sym[c.op]} ${v}`.trim();
}

type Matcher = (facts: Facts) => { hit: boolean; used: { field: string; test: string }[] };

const astCache = new Map<string, Node>();
function ast(src: string) {
  let a = astCache.get(src);
  if (!a) {
    a = parse(src);
    if (astCache.size > 500) astCache.clear();
    astCache.set(src, a);
  }
  return a;
}

export function compile(w: When, fmt: (v: unknown, key: string) => string): Matcher {
  if (w.expr !== undefined) {
    const src = w.expr;
    return (facts) => {
      const n = ast(src);
      const hit = Boolean(evaluate(n, facts));
      return { hit, used: [...referenced(n)].map((f) => ({ field: f, test: "formula" })) };
    };
  }
  if (w.not) {
    const inner = isWhen(w.not) ? compile(w.not, fmt) : compile({ all: [w.not] }, fmt);
    return (facts) => {
      const r = inner(facts);
      return { hit: !r.hit, used: r.used.map((u) => ({ ...u, test: `not (${u.test})` })) };
    };
  }
  const any = !!w.any;
  const items = (w.any ?? w.all ?? []).map((it): Matcher => {
    if (isWhen(it)) return compile(it, fmt);
    const c = it as Condition;
    const test = describeTest(c, fmt);
    return (facts) => ({ hit: testCondition(c, facts), used: [{ field: c.field, test }] });
  });
  return (facts) => {
    const used: { field: string; test: string }[] = [];
    if (any) {
      let hit = false;
      for (const m of items) {
        const r = m(facts);
        if (r.hit) {
          hit = true;
          used.push(...r.used);
        }
      }
      return { hit, used };
    }
    for (const m of items) {
      const r = m(facts);
      if (!r.hit) return { hit: false, used: [] };
      used.push(...r.used);
    }
    return { hit: true, used };
  };
}

/** {{arr}} → "₹48 L" */
export function renderMessage(tpl: string, facts: Facts, fmt: (v: unknown, key: string) => string, rule: Rule) {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => (k === "rule" ? rule.name : fmt(facts[k], k)));
}

/** A readable one-line version of a rule's condition. */
export function whenText(w: When, fmt: (v: unknown, key: string) => string): string {
  if (w.expr !== undefined) return w.expr;
  if (w.not) return `NOT (${isWhen(w.not) ? whenText(w.not, fmt) : whenText({ all: [w.not] }, fmt)})`;
  const join = w.any ? " OR " : " AND ";
  return (w.any ?? w.all ?? [])
    .map((it) => {
      if (isWhen(it)) return `(${whenText(it, fmt)})`;
      const c = it as Condition;
      const f = FIELD[c.field];
      if (c.op === "is_true") return `${f?.label ?? c.field} = yes`;
      if (c.op === "is_false") return `${f?.label ?? c.field} = no`;
      return `${f?.label ?? c.field} ${describeTest(c, fmt)}`;
    })
    .join(join);
}
