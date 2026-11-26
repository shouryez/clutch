/**
 * Contract intelligence: every contract's renewal mechanics in one place, and an
 * extractor that reads a pasted MSA / order form and pulls out the dates and
 * clauses that decide a renewal — with the exact sentence each came from.
 */
import { inrCompact } from "./format";
import { llmJSON } from "./llmjson";
import { daysUntil } from "./risk";
import { freshUsage, PRICE } from "./seed";
import { emit, getHealth, recompute, store } from "./store";
import type { Account, Clause, Plan } from "./types";

export function contractsView() {
  return store().accounts.map((a) => {
    const h = getHealth(a.id);
    const noticeBy = new Date(a.contract.end + "T00:00:00");
    noticeBy.setDate(noticeBy.getDate() - a.contract.noticeDays);
    return {
      id: a.id,
      name: a.name,
      arr: a.arr,
      plan: a.plan,
      seats: a.seats,
      start: a.contract.start,
      end: a.contract.end,
      termMonths: a.contract.termMonths,
      noticeDays: a.contract.noticeDays,
      noticeBy: noticeBy.toISOString().slice(0, 10),
      autoRenew: a.contract.autoRenew,
      upliftPct: a.contract.upliftPct,
      paymentTerms: a.contract.paymentTerms,
      daysToRenewal: h.daysToRenewal,
      daysToNotice: h.daysToNotice,
      tier: h.tier,
      renewed: store().renewed.has(a.id),
      imported: a.industry === "—",
    };
  });
}

export type Extracted = {
  customer: string;
  effectiveDate: string;
  termMonths: number;
  endDate: string;
  noticeDays: number;
  autoRenew: boolean;
  upliftPct: number;
  paymentTerms: string;
  seats: number;
  plan: Plan;
  pricePerSeatMonth: number;
  signatory: { name: string; title: string; email: string };
  evidence: Partial<Record<"customer" | "effectiveDate" | "termMonths" | "noticeDays" | "autoRenew" | "upliftPct" | "paymentTerms" | "seats" | "price", string>>;
};

const WORDNUM: Record<string, number> = { twelve: 12, "twenty-four": 24, "thirty-six": 36, thirty: 30, sixty: 60, ninety: 90, "forty-five": 45, fifteen: 15 };

function sentence(text: string, re: RegExp) {
  const m = re.exec(text);
  if (!m) return undefined;
  const start = Math.max(text.lastIndexOf(".", m.index) + 1, text.lastIndexOf("\n", m.index) + 1);
  const endDot = text.indexOf(".", m.index + m[0].length);
  return text.slice(start, endDot < 0 ? undefined : endDot + 1).trim();
}

function addMonths(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function toIso(s: string | undefined) {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s.replace(/(\d+)(st|nd|rd|th)/, "$1"));
  return isNaN(d.getTime()) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Regex reader — always runs, and fills anything the model misses. */
function rules(text: string): Extracted {
  const num = (re: RegExp) => {
    const m = re.exec(text);
    if (!m) return undefined;
    const raw = m[1].toLowerCase();
    return Number(raw.replace(/[^\d.]/g, "")) || WORDNUM[raw];
  };
  const customer = /between\s+Helpdeck[^,]*,?\s+(?:and|&)\s+([A-Z][\w&.\- ]+?)(?:\s*\(|,|\s+having)/i.exec(text)?.[1]?.trim() ?? /Customer:\s*([^\n]+)/i.exec(text)?.[1]?.trim() ?? "New customer";
  const eff = toIso(/effective date[^0-9a-z]*(?:is|:|of)?\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4}|\w+\s+\d{1,2},\s*\d{4}|\d{4}-\d{2}-\d{2})/i.exec(text)?.[1]);
  const term = num(/(?:initial term|term)[^.]*?\(?(\d+|twelve|twenty-four|thirty-six)\)?\s*months/i) ?? 12;
  const notice = num(/(?:not less than|at least)\s*(\w+(?:-\w+)?)\s*\(?\d*\)?\s*days/i) ?? 30;
  const uplift = num(/increase[^.]*?by (?:up to |no more than )?(\d+(?:\.\d+)?)\s*%/i) ?? 0;
  const seats = num(/(\d+)\s+(?:named\s+)?(?:agent\s+)?seats/i) ?? 25;
  const price = num(/(?:INR|₹|Rs\.?)\s*([\d,]+)\s*(?:per|\/)\s*(?:seat|agent)/i) ?? 0;
  const plan = (/\b(Starter|Growth|Enterprise)\b/.exec(text)?.[1] as Plan) ?? "Growth";
  const autoRenew = /automatically renew/i.test(text) && !/shall not automatically renew/i.test(text);
  const pay = /payable within\s+(\w+)\s*\(?(\d+)?\)?\s*days/i.exec(text);
  const payDays = pay ? Number(pay[2]) || WORDNUM[pay[1].toLowerCase()] || 30 : 30;
  const sig = /(?:By|Name):\s*([A-Z][a-z]+\s[A-Z][a-z]+)\s*[\n,]\s*(?:Title:\s*)?([^\n]+)/.exec(text);
  const email = /[\w.+-]+@[\w-]+\.[\w.]+/.exec(text)?.[0] ?? "";
  const start = eff || new Date().toISOString().slice(0, 10);
  return {
    customer,
    effectiveDate: start,
    termMonths: term,
    endDate: addMonths(start, term),
    noticeDays: notice,
    autoRenew,
    upliftPct: uplift,
    paymentTerms: `Net ${payDays}`,
    seats,
    plan,
    pricePerSeatMonth: price || PRICE[plan],
    signatory: { name: sig?.[1] ?? "", title: sig?.[2]?.trim() ?? "", email },
    evidence: {
      customer: sentence(text, /between\s+Helpdeck/i),
      effectiveDate: sentence(text, /effective date/i),
      termMonths: sentence(text, /initial term/i),
      noticeDays: sentence(text, /not less than|at least \w+ days/i),
      autoRenew: sentence(text, /automatically renew|expire at the end/i),
      upliftPct: sentence(text, /increase[^.]*%/i),
      paymentTerms: sentence(text, /payable within/i),
      seats: sentence(text, /\d+\s+(?:named\s+)?(?:agent\s+)?seats/i),
      price: sentence(text, /(?:INR|₹|Rs\.?)\s*[\d,]+\s*(?:per|\/)/i),
    },
  };
}

export async function extract(text: string) {
  const t0 = Date.now();
  const base = rules(text);
  const sys = `You read SaaS contracts (MSA / order forms) for a renewals team. Extract renewal mechanics exactly as written.
JSON: {"customer": string, "effectiveDate": "YYYY-MM-DD", "termMonths": number, "noticeDays": number, "autoRenew": boolean, "upliftPct": number, "paymentTerms": "Net N", "seats": number, "plan": "Starter"|"Growth"|"Enterprise", "pricePerSeatMonth": number (INR), "signatory": {"name": string, "title": string, "email": string}, "risks": [string] (max 3, clauses that hurt renewal e.g. termination for convenience, price caps, short notice)}`;
  const out = await llmJSON<Partial<Extracted> & { risks?: string[] }>(sys, text.slice(0, 9000), { maxTokens: 600, timeoutMs: 14000 });
  const m = out?.data ?? {};
  const pick = <K extends keyof Extracted>(k: K, ok: (v: unknown) => boolean) => (ok(m[k]) ? (m[k] as Extracted[K]) : base[k]);
  const eff = toIso(m.effectiveDate as string) || base.effectiveDate;
  const term = pick("termMonths", (v) => Number(v) > 0);
  const merged: Extracted = {
    ...base,
    customer: pick("customer", (v) => typeof v === "string" && v.length > 1),
    effectiveDate: eff,
    termMonths: Number(term),
    endDate: addMonths(eff, Number(term)),
    noticeDays: Number(pick("noticeDays", (v) => Number(v) > 0)),
    autoRenew: pick("autoRenew", (v) => typeof v === "boolean"),
    upliftPct: Number(pick("upliftPct", (v) => Number(v) >= 0 && Number(v) < 50)),
    paymentTerms: pick("paymentTerms", (v) => typeof v === "string" && /net/i.test(v as string)),
    seats: Number(pick("seats", (v) => Number(v) > 0)),
    plan: pick("plan", (v) => ["Starter", "Growth", "Enterprise"].includes(v as string)),
    pricePerSeatMonth: Number(pick("pricePerSeatMonth", (v) => Number(v) > 100)),
    // exact strings from the page beat the model (it can misspell an email)
    signatory: { name: base.signatory.name || m.signatory?.name || "", title: base.signatory.title || m.signatory?.title || "", email: base.signatory.email || m.signatory?.email || "" },
  };
  const risks = (out?.data.risks ?? []).filter((x) => typeof x === "string").slice(0, 3);
  if (!risks.length) {
    if (merged.noticeDays >= 60) risks.push(`Long ${merged.noticeDays}-day notice window — the save has to start early.`);
    if (!merged.autoRenew) risks.push("No auto-renew: the contract lapses unless renewed in writing.");
    if (/terminat\w+ for convenience/i.test(text)) risks.push("Termination for convenience allowed.");
  }
  const nb = new Date(merged.endDate + "T00:00:00");
  nb.setDate(nb.getDate() - merged.noticeDays);
  const noticeBy = nb.toISOString().slice(0, 10);
  return { extracted: merged, risks, model: out?.model ?? "rules", ms: Date.now() - t0, noticeBy, daysToRenewal: daysUntil(merged.endDate) };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function clauses(x: Extracted): Clause[] {
  return [
    { key: "term", label: "Renewal date", value: x.endDate, quote: x.evidence.termMonths ?? `Initial Term of ${x.termMonths} months.`, page: 1 },
    { key: "seats", label: "Licensed seats", value: `${x.seats} × ${x.plan}`, quote: x.evidence.seats ?? `${x.seats} seats.`, page: 2 },
    { key: "uplift", label: "Renewal uplift", value: `up to ${x.upliftPct}%`, quote: x.evidence.upliftPct ?? "—", page: 3 },
    { key: "payment", label: "Payment terms", value: x.paymentTerms, quote: x.evidence.paymentTerms ?? "—", page: 3 },
    { key: "autorenew", label: "Auto-renew", value: x.autoRenew ? "Yes, 12 months" : "No", quote: x.evidence.autoRenew ?? "—", page: 4 },
    { key: "notice", label: "Notice period", value: `${x.noticeDays} days`, quote: x.evidence.noticeDays ?? "—", page: 4 },
  ];
}

/** Add or update the account this contract belongs to. */
export function importContract(x: Extracted) {
  const s = store();
  const id = slug(x.customer);
  let a = s.accounts.find((y) => y.id === id || y.name.toLowerCase() === x.customer.toLowerCase());
  const contract = { start: x.effectiveDate, end: x.endDate, termMonths: x.termMonths, noticeDays: x.noticeDays, autoRenew: x.autoRenew, upliftPct: x.upliftPct, paymentTerms: x.paymentTerms, clauses: clauses(x) };
  const created = !a;
  if (a) {
    a.contract = contract;
    a.seats = x.seats;
    a.plan = x.plan;
    a.pricePerSeatMonth = x.pricePerSeatMonth;
    a.arr = x.seats * x.pricePerSeatMonth * 12;
  } else {
    const dom = slug(x.customer).replace(/-/g, "") + ".in";
    const sig = x.signatory.name || "Account Owner";
    a = {
      id,
      name: x.customer,
      industry: "—",
      city: "—",
      plan: x.plan,
      seats: x.seats,
      pricePerSeatMonth: x.pricePerSeatMonth,
      arr: x.seats * x.pricePerSeatMonth * 12,
      csm: "Meera Kapoor",
      story: "none",
      features: ["tickets", "automations", "reports"],
      contacts: [
        { id: `${id}-c1`, name: sig, role: x.signatory.title || "Head of Support", email: x.signatory.email || `${sig.split(" ")[0].toLowerCase()}@${dom}`, phone: "", isChampion: true, isExecSponsor: false, lastActiveDaysAgo: 1, bounced: false },
      ],
      contract,
      usage: freshUsage(x.seats, 0.82, id),
      tickets: [],
      emails: [],
      invoices: [],
      stripeSubscriptionId: `sub_${id.replace(/-/g, "").slice(0, 10)}`,
    } satisfies Account;
    s.accounts.push(a);
  }
  recompute(a.id);
  const h = getHealth(a.id);
  emit({ kind: "system", accountId: a.id, accountName: a.name, title: `${created ? "New contract imported" : "Contract updated"}: ${a.name}`, detail: `${inrCompact(a.arr)} · renews ${x.endDate} · ${x.noticeDays}-day notice · risk ${h.risk}`, tone: "neutral" });
  return { id: a.id, created };
}

export const SAMPLE_CONTRACT = `MASTER SUBSCRIPTION AGREEMENT

This Master Subscription Agreement is made between Helpdeck Software Pvt. Ltd. ("Helpdeck") and Tarang Telecom Ltd (the "Customer"), having its office at Bengaluru.

1. TERM
1.1 The Effective Date is 2 February 2026.
1.2 The Initial Term commences on the Effective Date and continues for twelve (12) months.

2. SUBSCRIPTION
2.1 Customer is licensed for 64 named Agent seats on the Enterprise plan (Schedule A).
2.2 Fees are INR 9,500 per seat per month, billed annually in advance.

3. FEES
3.1 Invoices are payable within thirty (30) days of the invoice date.
3.2 Fees for any Renewal Term may increase by up to 8% over the fees for the preceding Term.

9. RENEWAL AND TERMINATION
9.1 This Agreement shall automatically renew for successive periods of twelve (12) months unless either party gives notice under Clause 9.2.
9.2 Either party may elect not to renew by giving not less than sixty (60) days' written notice prior to the end of the then-current Term.
9.3 Customer may terminate for convenience on ninety (90) days' notice, subject to payment of fees for the remainder of the Term.

Signed for the Customer
By: Ishaan Mehra
Title: Director, Customer Care
Email: ishaan.mehra@tarangtelecom.in`;
