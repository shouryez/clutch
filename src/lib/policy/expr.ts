/**
 * A tiny, safe formula language for policy rules. No eval, no globals: the
 * only names a formula can see are the documented facts of the entity.
 *
 *   arr >= 25L && daysToNotice <= 14 && !hasChampion
 *   industry in ["Healthcare", "Financial services"] and discountPct > 5
 *   contains(lower(competitor), "fresh") || openP1Tickets >= 2
 *
 * Numbers accept Indian money suffixes: 50k, 10L, 1.2Cr.
 */

export type Val = number | string | boolean | null | Val[];

type Tok =
  | { t: "num"; v: number; at: number }
  | { t: "str"; v: string; at: number }
  | { t: "id"; v: string; at: number }
  | { t: "op"; v: string; at: number }
  | { t: "eof"; at: number };

export type Node =
  | { k: "lit"; v: Val }
  | { k: "id"; name: string; at: number }
  | { k: "list"; items: Node[] }
  | { k: "un"; op: string; a: Node }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "call"; fn: string; args: Node[]; at: number };

export class ExprError extends Error {
  constructor(
    message: string,
    public at: number,
  ) {
    super(message);
  }
}

const SUFFIX: Record<string, number> = { k: 1e3, K: 1e3, l: 1e5, L: 1e5, lakh: 1e5, cr: 1e7, Cr: 1e7, CR: 1e7 };
const WORD_OPS: Record<string, string> = { and: "&&", or: "||", not: "!", in: "in" };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const at = i;
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i;
      while (j < src.length && /[0-9._]/.test(src[j])) j++;
      let n = Number(src.slice(i, j).replace(/_/g, ""));
      const m = /^(lakh|Cr|CR|cr|k|K|L|l)(?![A-Za-z0-9_])/.exec(src.slice(j));
      if (m) {
        n *= SUFFIX[m[1]];
        j += m[1].length;
      } else if (src[j] === "%") j++; // 12% reads as 12 (facts are in percent)
      if (Number.isNaN(n)) throw new ExprError(`bad number "${src.slice(i, j)}"`, at);
      out.push({ t: "num", v: n, at });
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\\" && j + 1 < src.length) j++;
        s += src[j++];
      }
      if (j >= src.length) throw new ExprError("unterminated string", at);
      out.push({ t: "str", v: s, at });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) j++;
      const w = src.slice(i, j);
      if (WORD_OPS[w.toLowerCase()]) out.push({ t: "op", v: WORD_OPS[w.toLowerCase()], at });
      else out.push({ t: "id", v: w, at });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["==", "!=", ">=", "<=", "&&", "||"].includes(two)) {
      out.push({ t: "op", v: two, at });
      i += 2;
      continue;
    }
    if ("+-*/%<>!()[],=".includes(c)) {
      out.push({ t: "op", v: c === "=" ? "==" : c, at });
      i++;
      continue;
    }
    throw new ExprError(`unexpected character "${c}"`, at);
  }
  out.push({ t: "eof", at: src.length });
  return out;
}

const PREC: Record<string, number> = { "||": 1, "&&": 2, "==": 3, "!=": 3, in: 3, "<": 4, "<=": 4, ">": 4, ">=": 4, "+": 5, "-": 5, "*": 6, "/": 6, "%": 6 };

export function parse(src: string): Node {
  const toks = lex(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const expect = (v: string) => {
    const t = next();
    if (t.t !== "op" || t.v !== v) throw new ExprError(`expected "${v}"`, t.at);
  };

  function primary(): Node {
    const t = next();
    if (t.t === "num") return { k: "lit", v: t.v };
    if (t.t === "str") return { k: "lit", v: t.v };
    if (t.t === "id") {
      const low = t.v.toLowerCase();
      if (low === "true" || low === "false") return { k: "lit", v: low === "true" };
      if (low === "null" || low === "none") return { k: "lit", v: null };
      if (peek().t === "op" && (peek() as { v: string }).v === "(") {
        next();
        const args: Node[] = [];
        if (!(peek().t === "op" && (peek() as { v: string }).v === ")")) {
          do args.push(expr(0));
          while (peek().t === "op" && (peek() as { v: string }).v === "," && next());
        }
        expect(")");
        if (!FUNCS[t.v]) throw new ExprError(`unknown function "${t.v}()" — try ${Object.keys(FUNCS).join(", ")}`, t.at);
        return { k: "call", fn: t.v, args, at: t.at };
      }
      return { k: "id", name: t.v, at: t.at };
    }
    if (t.t === "op" && t.v === "(") {
      const e = expr(0);
      expect(")");
      return e;
    }
    if (t.t === "op" && t.v === "[") {
      const items: Node[] = [];
      if (!(peek().t === "op" && (peek() as { v: string }).v === "]")) {
        do items.push(expr(0));
        while (peek().t === "op" && (peek() as { v: string }).v === "," && next());
      }
      expect("]");
      return { k: "list", items };
    }
    if (t.t === "op" && (t.v === "!" || t.v === "-")) return { k: "un", op: t.v, a: expr(7) };
    throw new ExprError(t.t === "eof" ? "formula ends too early" : `unexpected "${(t as { v: string }).v}"`, t.at);
  }

  function expr(min: number): Node {
    let left = primary();
    for (;;) {
      const t = peek();
      // "not in"
      if (t.t === "op" && t.v === "!" && toks[p + 1]?.t === "op" && (toks[p + 1] as { v: string }).v === "in" && PREC.in > min) {
        p += 2;
        left = { k: "un", op: "!", a: { k: "bin", op: "in", a: left, b: expr(PREC.in) } };
        continue;
      }
      if (t.t !== "op" || !(t.v in PREC) || PREC[t.v] <= min) break;
      next();
      left = { k: "bin", op: t.v, a: left, b: expr(PREC[t.v]) };
    }
    return left;
  }

  const root = expr(0);
  const end = peek();
  if (end.t !== "eof") throw new ExprError(`unexpected "${(end as { v: string }).v}" — missing && or ||?`, end.at);
  return root;
}

const str = (v: Val) => (v === null ? "" : Array.isArray(v) ? v.join(",") : String(v));
const num = (v: Val) => (typeof v === "number" ? v : typeof v === "boolean" ? Number(v) : Number(v));

const FUNCS: Record<string, (...a: Val[]) => Val> = {
  lower: (s) => str(s).toLowerCase(),
  upper: (s) => str(s).toUpperCase(),
  len: (s) => (Array.isArray(s) ? s.length : str(s).length),
  contains: (h, n) => (Array.isArray(h) ? h.some((x) => str(x).toLowerCase() === str(n).toLowerCase()) : str(h).toLowerCase().includes(str(n).toLowerCase())),
  startsWith: (s, p) => str(s).toLowerCase().startsWith(str(p).toLowerCase()),
  matches: (s, re) => {
    try {
      return new RegExp(str(re), "i").test(str(s));
    } catch {
      return false;
    }
  },
  min: (...a) => Math.min(...a.map(num)),
  max: (...a) => Math.max(...a.map(num)),
  abs: (n) => Math.abs(num(n)),
  round: (n) => Math.round(num(n)),
  between: (n, lo, hi) => num(n) >= num(lo) && num(n) <= num(hi),
  isEmpty: (s) => s === null || s === "" || (Array.isArray(s) && s.length === 0),
};
export const FUNCTION_NAMES = Object.keys(FUNCS);

function eq(a: Val, b: Val): boolean {
  if (typeof a === "string" || typeof b === "string") return str(a).toLowerCase() === str(b).toLowerCase();
  return a === b;
}

export function evaluate(n: Node, facts: Record<string, Val>): Val {
  switch (n.k) {
    case "lit":
      return n.v;
    case "id": {
      if (!(n.name in facts)) throw new ExprError(`unknown field "${n.name}"`, n.at);
      return facts[n.name];
    }
    case "list":
      return n.items.map((x) => evaluate(x, facts));
    case "un": {
      const v = evaluate(n.a, facts);
      return n.op === "!" ? !v : -num(v);
    }
    case "call":
      return FUNCS[n.fn](...n.args.map((x) => evaluate(x, facts)));
    case "bin": {
      if (n.op === "&&") return Boolean(evaluate(n.a, facts)) && Boolean(evaluate(n.b, facts));
      if (n.op === "||") return Boolean(evaluate(n.a, facts)) || Boolean(evaluate(n.b, facts));
      const a = evaluate(n.a, facts);
      const b = evaluate(n.b, facts);
      switch (n.op) {
        case "==":
          return eq(a, b);
        case "!=":
          return !eq(a, b);
        case "<":
          return num(a) < num(b);
        case "<=":
          return num(a) <= num(b);
        case ">":
          return num(a) > num(b);
        case ">=":
          return num(a) >= num(b);
        case "+":
          return typeof a === "string" || typeof b === "string" ? str(a) + str(b) : num(a) + num(b);
        case "-":
          return num(a) - num(b);
        case "*":
          return num(a) * num(b);
        case "/":
          return num(b) === 0 ? 0 : num(a) / num(b);
        case "%":
          return num(b) === 0 ? 0 : num(a) % num(b);
        case "in":
          return Array.isArray(b) ? b.some((x) => eq(a, x)) : str(b).toLowerCase().includes(str(a).toLowerCase());
      }
    }
  }
  return null;
}

/** Field names a formula reads — shown as the evidence for a match. */
export function referenced(n: Node, out = new Set<string>()): Set<string> {
  if (n.k === "id") out.add(n.name);
  else if (n.k === "list") n.items.forEach((x) => referenced(x, out));
  else if (n.k === "un") referenced(n.a, out);
  else if (n.k === "bin") {
    referenced(n.a, out);
    referenced(n.b, out);
  } else if (n.k === "call") n.args.forEach((x) => referenced(x, out));
  return out;
}
