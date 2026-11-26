/**
 * Conversation brain for renewal negotiations (text chat and voice).
 *
 * Deterministic and keyless: intent parsing + an offer ladder. Every offer goes through
 * dealdesk.validate(), so the guardrails hold no matter who drives the conversation.
 * When an LLM is wired in it replaces the phrasing and intent parsing, and still has to
 * call propose() — the same choke point.
 */
import { slackPost } from "./adapters";
import { agentEnabled, agentSay, agentTurn } from "./agent";
import { compose, llmEnabled, understand, type Intent } from "./llm";
import { leverage, POLICY, validate, type Proposal } from "./dealdesk";
import { inr, inrCompact } from "./format";
import { startPlay } from "./runner";
import { emit, getAccount, getHealth, resolveWait, store, uid } from "./store";
import type { Account, Contact, Offer } from "./types";

export type Lang = "en" | "hi";
export type Msg = { id: string; who: "clutch" | "customer" | "system"; text: string; at: number; lang: Lang; speech?: string };
export type GuardLog = { at: number; fn: "propose" | "approve"; args: string; result: string; tone: "ok" | "bad" | "wait" };
type Rung = { discountPct: number; termMonths: number; extras: string[] };

export type DealSession = {
  id: string;
  accountId: string;
  channel: "chat" | "voice";
  lang: Lang;
  stage: "opening" | "listening" | "offered" | "awaiting-approval" | "agreed";
  messages: Msg[];
  log: GuardLog[];
  rung: number; // index into LADDER of the current offer, -1 none
  current?: Rung & { price: number };
  pendingApproval?: Rung & { price: number };
  approved: number; // highest approved discount
  asks: number[]; // discounts the customer asked for
  gave: string[];
  got: string[];
  sentiment: number; // -1..1
  risk: number; // live projection for the mirror
  topics: string[]; // what we've already addressed
  offerId?: string;
  pendingSystem?: string;
  offered: number[]; // ladder rungs actually put on the table
  concededThisTurn?: boolean;
  contact: Contact;
  startedAt: number;
  summary?: CallSummary;
};

export type CallSummary = {
  outcome: string;
  summary: string;
  objections: string[];
  commitments: string[];
  nextSteps: string[];
  sentiment: "positive" | "neutral" | "negative";
  model: string;
  at: number;
};

const LADDER: Rung[] = [
  { discountPct: 0.05, termMonths: 12, extras: [] },
  { discountPct: 0.08, termMonths: 24, extras: [] },
  { discountPct: 0.1, termMonths: 24, extras: ["onboarding"] },
  { discountPct: 0.12, termMonths: 24, extras: ["onboarding"] },
  { discountPct: 0.15, termMonths: 36, extras: ["onboarding", "case-study"] },
];

const HI_WORDS = /\b(haan|haa|han|nahi|nahin|yaar|hai|hain|kya|karo|kar|karna|bhejo|bhej|theek|thik|dekh|rahe|raha|rahi|hum|humein|aap|mujhe|chahiye|lekin|warna|accha|acha|achha|bahut|kyun|kyon|saal|sal|mahine|chalega|ho|hoga|kitna|kam|zyada|paisa|mehenga|sahi|bilkul|abhi|batao|bolo)\b/gi;

function detectLang(text: string, prev: Lang): Lang {
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  const n = (text.match(HI_WORDS) ?? []).length;
  if (n >= 2) return "hi";
  if (n === 0 && text.split(/\s+/).length >= 4) return "en";
  return prev;
}

function looksHinglish(t: string) {
  return /[ऀ-ॿ]/.test(t) || (t.match(HI_WORDS) ?? []).length >= 2;
}

/** Gemini phrasing with a language check: one retry, then the engine's own wording. */
async function phrase(input: Parameters<typeof compose>[0]) {
  for (let i = 0; i < 2; i++) {
    const c = await compose(input);
    if (!c) return null;
    if (input.lang !== "hi" || looksHinglish(c.reply)) return c;
  }
  return null;
}

const POS = /\b(good|great|thanks|thank|ok|okay|fine|love|happy|sure|deal|theek|accha|acha|badhiya|sahi|haan|perfect|nice)\b/gi;
const NEG = /\b(bad|angry|broken|fail|failing|failed|issue|problem|frustrat|terrible|worst|cancel|leave|switch|expensive|mehenga|bakwas|bekar|mushkil|pareshan|nahi|not|never)\b/gi;
function sentimentOf(t: string) {
  const p = (t.match(POS) ?? []).length;
  const n = (t.match(NEG) ?? []).length;
  if (!p && !n) return 0;
  return Math.max(-1, Math.min(1, (p - n) / Math.max(2, p + n)));
}

const HINDI_NUMS: Record<string, number> = {
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, che: 6, saat: 7, aath: 8, nau: 9, das: 10,
  gyarah: 11, gyaarah: 11, barah: 12, baarah: 12, baara: 12, terah: 13, chaudah: 14, pandrah: 15, pandra: 15,
  solah: 16, satrah: 17, atharah: 18, unnis: 19, bees: 20, bis: 20, pachees: 25, pachis: 25, pachchees: 25, pacchis: 25, tees: 30, chalis: 40, pachas: 50,
  "एक": 1, "दो": 2, "पांच": 5, "पाँच": 5, "आठ": 8, "दस": 10, "बारह": 12, "पंद्रह": 15, "बीस": 20, "पच्चीस": 25, "तीस": 30,
};
export function digitize(text: string) {
  return text.replace(/[\p{L}\p{M}]+/gu, (w) => (HINDI_NUMS[w.toLowerCase()] !== undefined ? String(HINDI_NUMS[w.toLowerCase()]) : w));
}

function parse(text: string) {
  const t = digitize(text).toLowerCase();
  const pct = t.match(/(\d{1,2}(?:\.\d)?)\s*(%|percent|per cent|pc|pratishat|प्रतिशत|takka)/);
  const years = t.match(/(\d|one|two|three|ek|do|teen)\s*(years?|yrs?|saal|sal|साल)/);
  const months = t.match(/(\d{1,2})\s*(months?|mahine|mahina|mo\b)/);
  const yWord: Record<string, number> = { one: 1, two: 2, three: 3, ek: 1, do: 2, teen: 3 };
  let term: number | undefined;
  if (years) term = (Number(years[1]) || yWord[years[1]] || 1) * 12;
  else if (months) term = Number(months[1]);
  return {
    discount: pct ? Number(pct[1]) / 100 : /\b(discount|cheaper|kam karo|kam kar|reduce the price|better price)\b/.test(t) ? -1 : undefined,
    term,
    agree: /\b(ok|okay|deal|yes|yeah|yep|sure|fine|done|go ahead|send it|send|bhejo|bhej do|bhej dijiye|theek|thik|haan|chalega|agreed|sounds good|let'?s do it|confirm)\b/.test(t),
    refuse: /\b(no|nope|nahi|nahin|not enough|too (much|high|expensive)|mushkil|never)\b/.test(t),
    competitor: (t.match(/\b(freshdesk|zendesk|zoho|intercom|hubspot|freshworks)\b/) ?? [])[1] ?? (/\b(competitor|alternative|switch|switching|dusra|other tool|move to)\b/.test(t) ? "competitor" : undefined),
    bug: /\b(export|bug|fail|failing|broken|issue|problem|crash|slow|error|kaam nahi|chal nahi)\b/.test(t),
    price: /\b(expensive|costly|price|pricing|budget|mehenga|mehnga|cost)\b/.test(t),
    why: /\b(why|kyun|kyon|how come)\b/.test(t),
  };
}

function first(c: Contact) {
  return c.name.split(" ")[0];
}

function reachable(a: Account) {
  const ok = a.contacts.filter((x) => !x.bounced && !/cfo|ceo|coo|cto|vp|ciso/i.test(x.role));
  return a.contacts.find((x) => x.isChampion && !x.bounced && x.lastActiveDaysAgo <= 7) ?? [...ok].sort((x, y) => x.lastActiveDaysAgo - y.lastActiveDaysAgo)[0] ?? a.contacts[0];
}

/* ---------------- copy (EN + Hinglish) ---------------- */

function hook(a: Account, lang: Lang) {
  const bug = a.tickets.find((t) => t.status === "open" && (t.priority === "P1" || t.topic === "csv-export"));
  const h = getHealth(a.id);
  if (bug)
    return lang === "hi"
      ? `maine dekha ki aapki team ke exports is mahine kaafi baar fail hue — ticket ${bug.number} ${bug.openedDaysAgo} din se open hai`
      : `I saw exports have been failing for your team — ticket ${bug.number} has been open ${bug.openedDaysAgo} days`;
  if (h.signals.find((s) => s.key === "usage")!.value > 0.4)
    return lang === "hi" ? "maine dekha ki pichhle kuch hafton mein usage kaafi kam hua hai" : "I noticed usage has dropped over the last few weeks";
  return lang === "hi" ? "main aapke Helpdeck account ke baare mein call kar rahi hoon" : "I'm calling about your Helpdeck account";
}

function rungText(r: Rung & { price: number }, lang: Lang) {
  const pct = Math.round(r.discountPct * 100);
  const yrs = r.termMonths / 12;
  const extras = r.extras.length ? (lang === "hi" ? `, saath mein ${r.extras.map(extraName).join(" aur ")}` : `, plus ${r.extras.map(extraName).join(" and ")}`) : "";
  return lang === "hi"
    ? `${pct}% discount, ${yrs} saal ke liye — total ${inr(r.price)}${extras}`
    : `${pct}% off for ${yrs === 1 ? "one year" : `${yrs} years`} — ${inr(r.price)} in total${extras}`;
}

function extraName(e: string) {
  return { onboarding: "free onboarding for new agents", "case-study": "a joint case study", "free-month": "one free month", pause: "a billing pause", training: "a training session" }[e] ?? e;
}

/* ---------------- core ---------------- */

export function getSession(accountId: string, channel: "chat" | "voice" = "chat"): DealSession {
  const s = store();
  const existing = s.deals.get(accountId);
  if (existing) return existing;
  const a = getAccount(accountId);
  if (!a) throw new Error("unknown account");
  const contact = reachable(a);
  const ses: DealSession = {
    id: uid("deal"),
    accountId,
    channel,
    lang: "en",
    stage: "opening",
    messages: [],
    log: [],
    rung: -1,
    approved: POLICY.approvalAbove,
    asks: [],
    gave: [],
    got: [],
    sentiment: -0.2,
    risk: getHealth(accountId).risk,
    topics: [],
    offered: [],
    contact,
    startedAt: Date.now(),
  };
  const h = getHealth(accountId);
  const opening =
    channel === "voice"
      ? `Hi ${first(contact)}, this is Clutch — Helpdeck's AI renewal assistant. ${cap(hook(a, "en"))}. Your renewal is in ${h.daysToRenewal} days. Do you have two minutes?`
      : `Hi ${first(contact)} — Clutch here, Helpdeck's AI renewal assistant. ${cap(hook(a, "en"))}, and your renewal is in ${h.daysToRenewal} days. What would make renewing an easy yes for you?`;
  say(ses, "clutch", opening);
  s.deals.set(accountId, ses);
  return ses;
}

export function resetSession(accountId: string) {
  store().deals.delete(accountId);
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function say(ses: DealSession, who: Msg["who"], text: string, speech?: string) {
  const m: Msg = { id: uid("m"), who, text, at: Date.now(), lang: ses.lang, speech };
  ses.messages.push(m);
  const a = getAccount(ses.accountId)!;
  emit({
    kind: ses.channel === "voice" ? "call" : "deal",
    accountId: a.id,
    accountName: a.name,
    title: who === "clutch" ? "Clutch" : who === "customer" ? first(ses.contact) : "System",
    detail: text,
    tone: who === "system" ? "good" : "neutral",
  });
  return m;
}

function propose(ses: DealSession, a: Account, p: Proposal & { extras: string[] }) {
  const v = validate(a, p);
  const args = `discount=${p.discountPct.toFixed(2)} term=${p.termMonths}${p.extras.length ? ` +${p.extras.join("+")}` : ""}`;
  if (!v.ok) {
    ses.log.push({ at: Date.now(), fn: "propose", args, result: `✕ ${v.reasons[0]}`, tone: "bad" });
    return { ok: false as const, reason: v.reasons[0] };
  }
  if (v.needsApproval && p.discountPct > ses.approved + 1e-9) {
    ses.log.push({ at: Date.now(), fn: "propose", args, result: `⏸ needs approval > ${POLICY.approvalAbove.toFixed(2)}`, tone: "wait" });
    return { ok: "approval" as const, price: v.price };
  }
  ses.log.push({ at: Date.now(), fn: "propose", args, result: `✓ ${inr(v.price)} within policy`, tone: "ok" });
  return { ok: true as const, price: v.price };
}

function offerRung(ses: DealSession, a: Account, idx: number): string {
  const r = LADDER[Math.min(idx, LADDER.length - 1)];
  const res = propose(ses, a, { ...r });
  const hi = ses.lang === "hi";
  if (res.ok === "approval") {
    ses.pendingApproval = { ...r, price: res.price };
    ses.stage = "awaiting-approval";
    const pct = Math.round(r.discountPct * 100);
    void slackPost(`Approve ${pct}% for ${a.name}? ${inr(res.price)} · ${r.termMonths} months. Reply in Clutch.`);
    emit({ kind: "deal", accountId: a.id, accountName: a.name, title: `Approval requested: ${pct}% for ${a.name}`, detail: `${inr(res.price)} · ${r.termMonths} mo · #deal-desk`, tone: "action" });
    return hi
      ? `${pct}% tak jaane ke liye mujhe manager ka approval chahiye. Main abhi request kar rahi hoon — ek minute dijiye.`
      : `Going to ${pct}% needs my manager's sign-off. I'm requesting it now — give me a minute.`;
  }
  if (!res.ok) {
    const why = /policy [A-Z]+-\d+ \(([^)]+)\)/.exec(res.reason)?.[1];
    return hi ? "Yeh hamari policy ke bahar hai." : why ? `I can't do that one — our policy on "${why.toLowerCase()}" doesn't allow it.` : "That's outside what I'm allowed to offer.";
  }
  ses.rung = idx;
  if (!ses.offered.includes(idx)) ses.offered.push(idx);
  ses.current = { ...r, price: res.price };
  ses.stage = "offered";
  const gave = `${Math.round(r.discountPct * 100)}% discount`;
  ses.gave = [gave, ...r.extras.map(extraName)];
  ses.got = [r.termMonths > 12 ? `${r.termMonths}-month term` : "12-month renewal", ...(r.extras.includes("case-study") ? ["case study"] : [])];
  return hi ? `Main ${rungText(ses.current, "hi")} offer kar sakti hoon. Chalega?` : `I can do ${rungText(ses.current, "en")}. Does that work?`;
}

function agree(ses: DealSession, a: Account): string {
  const r = ses.current!;
  const offer: Offer = {
    id: uid("ofr"),
    accountId: a.id,
    listPrice: Math.round(r.price / (1 - r.discountPct)),
    price: r.price,
    discountPct: r.discountPct,
    termMonths: r.termMonths,
    seats: a.seats,
    extras: r.extras,
    status: "draft",
    createdAt: Date.now(),
    approvedBy: r.discountPct > POLICY.approvalAbove ? "Meera Kapoor" : undefined,
  };
  store().offers.push(offer);
  ses.offerId = offer.id;
  ses.stage = "agreed";
  ses.risk = Math.round(getHealth(a.id).risk * 0.2);
  ses.sentiment = Math.max(ses.sentiment, 0.6);

  // hand over to the play runner: continue a waiting play, or start a closing run
  const s = store();
  const waiting = s.runs.find((x) => x.accountId === a.id && x.status === "waiting" && x.steps.some((st) => st.key === "call" && st.status === "waiting"));
  if (waiting) {
    waiting.offerId = offer.id;
    resolveWait(`advance:${waiting.id}`, `agreed ${Math.round(r.discountPct * 100)}% · ${r.termMonths} mo with ${ses.contact.name}`);
  } else {
    startPlay(a.id, "negotiated", { offerId: offer.id });
  }
  ses.pendingSystem = `Agreed: ${inr(r.price)} · ${r.termMonths} months · order form → ${ses.contact.email}`;
  return ses.lang === "hi"
    ? `Bahut badhiya, ${first(ses.contact)}! Order form abhi aapke email pe bhej rahi hoon — phone pe bhi link aa jayega. Sign karte hi sab update ho jayega.`
    : `Great, ${first(ses.contact)}. I'm sending the order form to your email right now — you'll get the link on your phone too. Once you sign, everything updates automatically.`;
}

/** Tool hook for the Gemini agent: put an exact offer on the table, snapped to the ladder and validated. */
export function offerExact(ses: DealSession, a: Account, discountPct: number, termMonths: number) {
  const fmt = (r: { discountPct: number; termMonths: number; price: number; extras: string[] }) => ({
    discount: `${Math.round(r.discountPct * 100)}%`,
    term: `${r.termMonths} months`,
    total_price: inr(r.price),
    extras: r.extras.map(extraName),
    summary: `${Math.round(r.discountPct * 100)}% off for ${r.termMonths} months, total ${inr(r.price)}${r.extras.length ? ` + ${r.extras.map(extraName).join(" + ")}` : ""}`,
  });
  if (ses.stage === "awaiting-approval") return { status: "waiting_for_manager", note: "Approval already requested — tell the customer you're waiting for it." };
  if (discountPct > POLICY.maxDiscount + 1e-9) {
    propose(ses, a, { discountPct, termMonths, extras: [] });
    return { status: "rejected", reason: `${Math.round(discountPct * 100)}% exceeds the hard limit of ${POLICY.maxDiscount * 100}%. Do not offer it. Make a counter-offer with make_offer.`, ...(ses.current ? { current_offer: fmt(ses.current) } : {}) };
  }
  // highest ladder rung not above the request
  let idx = 0;
  LADDER.forEach((r, i) => {
    if (r.discountPct <= discountPct + 1e-9) idx = i;
  });
  if (discountPct <= 0.001) idx = -1;
  // one concession step per customer turn
  const maxIdx = ses.concededThisTurn ? Math.max(ses.rung, 0) : ses.rung < 0 ? 1 : ses.rung + 1;
  let note = "";
  if (idx > maxIdx) {
    idx = maxIdx;
    note = "Adjusted: you can only concede one step per customer turn.";
  }
  if (idx < 0) {
    const v = validate(a, { discountPct: 0, termMonths: Math.max(12, termMonths), extras: [] });
    if (!v.ok) return { status: "rejected", reason: v.reasons[0] };
    ses.current = { discountPct: 0, termMonths: Math.max(12, termMonths), extras: [], price: v.price };
    ses.stage = "offered";
    return { status: "ok", offer: fmt(ses.current) };
  }
  const before = ses.stage;
  const logAt = ses.log.length;
  offerRung(ses, a, idx);
  const blocked = ses.log.slice(logAt).find((l) => l.tone === "bad");
  if (blocked) {
    return {
      status: "rejected",
      reason: `${blocked.result.replace(/^✕ /, "")}. This is the company's policy — do not offer it; explain briefly and offer the best allowed terms instead.`,
      ...(ses.current ? { current_offer: fmt(ses.current) } : {}),
    };
  }
  if ((ses.stage as DealSession["stage"]) === "awaiting-approval" && (before as DealSession["stage"]) !== "awaiting-approval") {
    return { status: "needs_manager_approval", requested: fmt(ses.pendingApproval!), note: "Approval requested from the manager. Tell the customer you're checking with your manager and will confirm in a moment. Do not promise it." };
  }
  ses.concededThisTurn = true;
  const r = ses.current!;
  if (termMonths < r.termMonths) note += ` Term set to ${r.termMonths} months: discounts above 5% need a longer commitment.`;
  return { status: "ok", offer: fmt(r), ...(note ? { note: note.trim() } : {}) };
}

/** Tool hook: the customer said yes to the offer on the table. */
export function agreeDeal(ses: DealSession, a: Account) {
  agree(ses, a);
  return { order_form_sent_to: ses.contact.email, total_price: inr(ses.current!.price), term: `${ses.current!.termMonths} months`, next: "Customer gets a signing link by email and on their phone." };
}

export async function approve(accountId: string, ok: boolean, by = "Meera Kapoor"): Promise<DealSession> {
  const ses = getSession(accountId);
  const a = getAccount(accountId)!;
  const p = ses.pendingApproval;
  if (!p) return ses;
  ses.pendingApproval = undefined;
  ses.log.push({ at: Date.now(), fn: "approve", args: `by=${by}`, result: ok ? `✓ ${Math.round(p.discountPct * 100)}% · ${inr(p.price)}` : "✕ denied", tone: ok ? "ok" : "bad" });
  emit({ kind: "deal", accountId: a.id, accountName: a.name, title: ok ? `${by} approved ${Math.round(p.discountPct * 100)}%` : `${by} denied the discount`, detail: inr(p.price), tone: ok ? "good" : "risk" });
  const hi = ses.lang === "hi";
  let draft: string;
  if (ok) {
    ses.approved = p.discountPct;
    const idx = LADDER.findIndex((r) => r.discountPct === p.discountPct);
    const msg = offerRung(ses, a, idx);
    draft = (hi ? "Good news — approval mil gaya. " : "Good news — it's approved. ") + msg;
  } else {
    ses.stage = ses.current ? "offered" : "listening";
    draft = hi ? `Manager ne approve nahi kiya. Meri best offer ${ses.current ? rungText(ses.current, "hi") : "abhi bhi valid hai"}.` : `My manager couldn't approve that. My best offer stands: ${ses.current ? rungText(ses.current, "en") : "as before"}.`;
  }
  const c = agentEnabled() ? await agentSay(ses, a, draft) : null;
  say(ses, "clutch", c?.reply ?? draft, c?.speech);
  return ses;
}

type Parsed = Omit<ReturnType<typeof parse>, "competitor"> & { competitor?: string };

function fromIntent(i: Intent): Parsed {
  return {
    discount: i.discountPct && i.discountPct > 0 ? (i.discountPct > 1 ? i.discountPct / 100 : i.discountPct) : i.wantsDiscount ? -1 : undefined,
    term: i.termMonths ?? undefined,
    agree: i.agree,
    refuse: i.refuse,
    competitor: i.competitor ? i.competitor.toLowerCase() : undefined,
    bug: i.bug,
    price: i.price,
    why: false,
  };
}

/** The decision engine. Returns the draft of what Clutch says; all business state changes happen here. */
function decide(ses: DealSession, a: Account, p: Parsed): { draft: string; agreed?: boolean } {
  const hi = ses.lang === "hi";
  const lv = leverage(a, p.competitor && p.competitor !== "competitor" ? 7000 : undefined);
  const parts: string[] = [];

  if (ses.stage === "awaiting-approval") return { draft: hi ? "Bas ek minute — manager ka jawab aa raha hai." : "One moment — still waiting on my manager's answer." };

  // 1. acknowledge pain the first time it comes up
  if (p.bug && !ses.topics.includes("bug")) {
    ses.topics.push("bug");
    const bug = a.tickets.find((t) => t.status === "open" && (t.topic === "csv-export" || t.priority === "P1"));
    const issue = store().issues.find((i) => i.topic === bug?.topic);
    parts.push(
      hi
        ? `Main samajh sakti hoon, yeh frustrating hai. Export fix Thursday ko ship ho raha hai — engineering ne ise P0 bana diya hai${issue ? ` (issue ${issue.number})` : ""}, aur main personally track kar rahi hoon.`
        : `That's fair, and I'm sorry. The export fix ships Thursday — engineering made it a P0${issue ? ` (issue ${issue.number})` : ""} and I'm tracking it personally.`,
    );
    ses.risk = Math.max(0, ses.risk - 12);
  }
  if (p.competitor && !ses.topics.includes("competitor")) {
    ses.topics.push("competitor");
    const name = p.competitor === "competitor" ? (hi ? "naye tool" : "a new tool") : cap(p.competitor);
    parts.push(
      hi
        ? `${name} pe ${a.seats} seats migrate karne ka cost lagbhag ${inrCompact(lv.migrationCost)} aayega — training, data migration aur downtime. Aur pichhle 90 din mein Helpdeck ne aapki team ke ~${lv.hoursSaved} ghante bachaye.`
        : `Moving ${a.seats} seats to ${name} would cost roughly ${inrCompact(lv.migrationCost)} in retraining, migration and downtime — and Helpdeck saved your team about ${lv.hoursSaved} hours in the last 90 days.`,
    );
    ses.risk = Math.max(0, ses.risk - 6);
  }

  // agreement wins when they're not asking for more than what's on the table
  if (p.agree && ses.current && !p.refuse && !(p.discount && p.discount > ses.current.discountPct + 1e-9)) {
    return { draft: [...parts, agree(ses, a)].join(" "), agreed: true };
  }

  // 2. pricing moves
  if (p.discount !== undefined || p.price || (p.refuse && ses.current)) {
    if (p.discount !== undefined && p.discount > 0) ses.asks.push(p.discount);
    const ask = p.discount && p.discount > 0 ? p.discount : undefined;
    if (ask && ask > POLICY.maxDiscount) {
      propose(ses, a, { discountPct: ask, termMonths: p.term ?? 12, extras: [] });
      parts.push(hi ? `${Math.round(ask * 100)}% possible nahi hai — yeh hard limit hai, mere haath mein nahi.` : `${Math.round(ask * 100)}% isn't possible — that's a hard limit, not a negotiating position.`);
    }
    // move one rung up (or to the rung that matches a smaller ask)
    let next = ses.rung < 0 ? 1 : ses.rung + 1;
    if (ask && ask <= POLICY.maxDiscount) {
      const fit = LADDER.findIndex((r) => r.discountPct >= ask - 1e-9);
      next = ses.rung < 0 ? Math.min(Math.max(1, fit), 2) : Math.min(fit >= 0 ? fit : next, ses.rung + 1);
      if (next <= ses.rung) next = ses.rung + 1;
    }
    if (p.term === 12 && next >= 1 && ses.rung < 1) {
      propose(ses, a, { discountPct: LADDER[next].discountPct, termMonths: 12, extras: [] });
      parts.push(hi ? "Ek saal pe main sirf 5% de sakti hoon — zyada discount ke liye 2 saal ka commitment chahiye." : "On a one-year term I can only do 5% — bigger discounts need a two-year commitment.");
      next = 0;
    }
    if (next >= LADDER.length) {
      parts.push(hi ? `Yeh meri final offer hai: ${rungText(ses.current!, "hi")}. Isse aage policy allow nahi karti.` : `This is my final offer: ${rungText(ses.current!, "en")}. Policy doesn't let me go further.`);
    } else {
      if (!ses.topics.includes("value") && ses.rung < 0) {
        ses.topics.push("value");
        parts.push(hi ? `Aapki team ne Helpdeck se ~${lv.hoursSaved} ghante bachaye hain, isliye main list price pe nahi rukungi.` : `Your team has saved about ${lv.hoursSaved} hours with us, so I won't hold you to list price.`);
      }
      parts.push(offerRung(ses, a, next));
    }
    ses.risk = Math.max(0, ses.risk - 8);
    return { draft: parts.join(" ") };
  }

  // 3. agreement
  if (p.agree && ses.current && !p.refuse) return { draft: [...parts, agree(ses, a)].join(" "), agreed: true };

  // 4. opening "yes I have two minutes" or general talk
  if (ses.stage === "opening") {
    ses.stage = "listening";
    if (!parts.length) parts.push(hi ? "Shukriya! Seedha poochti hoon — renewal ke liye aapko kya chahiye? Kya cheez aapko rok rahi hai?" : "Thanks! I'll be direct — what's in the way of renewing? What would you need from us?");
    return { draft: parts.join(" ") };
  }
  if (parts.length) {
    if (!ses.current) parts.push(hi ? "Agar aap 2 saal ke liye renew karein, toh main price pe bhi kuch kar sakti hoon. Bataiye?" : "If you renew for two years, I can also do something on price. Want me to put a number on it?");
    else parts.push(hi ? `Meri offer abhi bhi hai: ${rungText(ses.current, "hi")}.` : `My offer stands: ${rungText(ses.current, "en")}.`);
    return { draft: parts.join(" ") };
  }
  if (ses.current) return { draft: hi ? `Toh ${rungText(ses.current, "hi")} — order form bhej doon?` : `So: ${rungText(ses.current, "en")}. Shall I send the order form?` };
  return { draft: hi ? "Samajh gayi. Kya price ya term pe baat karein? Main 2 saal ke renewal pe accha deal de sakti hoon." : "Understood. Should we talk price and term? I can make a two-year renewal worth your while." };
}

function factsFor(a: Account, ses: DealSession) {
  const h = getHealth(a.id);
  const lv = leverage(a);
  return {
    company: a.name,
    customerName: ses.contact.name,
    customerRole: ses.contact.role,
    product: "Helpdeck (helpdesk / ticketing SaaS)",
    plan: a.plan,
    seats: a.seats,
    renewsInDays: h.daysToRenewal,
    noticeWindowClosesInDays: h.daysToNotice,
    agentHoursSavedLast90Days: lv.hoursSaved,
    openIssue: a.tickets.find((t) => t.status === "open" && t.priority !== "P3")?.subject ?? null,
    exportFixEta: "Thursday",
    currentOffer: ses.current ? { discountPct: Math.round(ses.current.discountPct * 100), termMonths: ses.current.termMonths, price: inr(ses.current.price), extras: ses.current.extras } : null,
    enterprisePlanIncludes: ["SAML SSO", "audit log", "unlimited automations", "priority support"],
  };
}

/**
 * One customer turn: understand (Gemini, else regex) → decide (rules engine) → phrase (Gemini, number-checked).
 * `display` is what the transcript shows (e.g. Latin-script Hinglish); `text` is what gets understood.
 */
export async function respond(accountId: string, text: string, channel: "chat" | "voice" = "chat", display?: string): Promise<DealSession> {
  const ses = getSession(accountId, channel);
  const a = getAccount(accountId)!;
  const history = ses.messages.filter((m) => m.who !== "system").map((m) => ({ who: m.who === "clutch" ? "Clutch" : "Customer", text: m.text }));

  if (ses.stage === "agreed") {
    say(ses, "customer", display ?? text);
    say(ses, "clutch", ses.lang === "hi" ? "Order form aapke paas hai — sign hote hi main confirm kar dungi. Aur kuch?" : "The order form is with you — I'll confirm the moment it's signed. Anything else?");
    return ses;
  }

  // primary path: Gemini agent with deal-desk tools
  if (agentEnabled()) {
    ses.lang = detectLang(display ?? text, ses.lang);
    say(ses, "customer", display ?? text);
    ses.concededThisTurn = false;
    const out = await agentTurn(ses, a, text);
    if (out) {
      if (/[\u0900-\u097F]/.test(out.speech) || (out.reply.match(HI_WORDS) ?? []).length >= 2) ses.lang = "hi";
      say(ses, "clutch", out.reply, out.speech);
      if (ses.pendingSystem) {
        say(ses, "system", ses.pendingSystem);
        ses.pendingSystem = undefined;
      }
      ses.risk = Math.max(0, ses.risk - ((ses.stage as DealSession["stage"]) === "agreed" ? 0 : 5));
      if ((ses.stage as DealSession["stage"]) === "agreed") ses.risk = Math.round(getHealth(a.id).risk * 0.2);
      return ses;
    }
    // agent unavailable → rules engine below (customer message already recorded)
    ses.messages.pop();
  }

  const intent = llmEnabled() ? await understand(text, history) : null;
  ses.lang = intent?.lang ?? detectLang(display ?? text, ses.lang);
  const s0 = intent ? intent.sentiment : sentimentOf(display ?? text);
  ses.sentiment = Math.max(-1, Math.min(1, ses.sentiment * 0.5 + s0 * 0.6 + 0.05));
  say(ses, "customer", display ?? text);

  const p = intent ? fromIntent(intent) : parse(display ?? text);
  if (intent && !(p.discount && p.discount > 0)) {
    const r = parse(display ?? text);
    const r2 = parse(text);
    const found = [r.discount, r2.discount].find((d) => d !== undefined && d > 0);
    if (found) p.discount = found;
  }
  const { draft, agreed } = decide(ses, a, p);

  let reply = draft;
  let speech: string | undefined;
  if (llmEnabled()) {
    const c = await phrase({ lang: ses.lang, channel, draft, customer: display ?? text, question: intent?.question ?? null, facts: factsFor(a, ses), history });
    if (c) {
      reply = c.reply;
      speech = c.speech;
    }
  }
  say(ses, "clutch", reply, speech);
  if (agreed && ses.pendingSystem) {
    say(ses, "system", ses.pendingSystem);
    ses.pendingSystem = undefined;
  }
  return ses;
}

export function dealView(accountId: string) {
  const ses = getSession(accountId);
  const a = getAccount(accountId)!;
  const comp = a.tickets.find((t) => t.competitor);
  const lv = leverage(a, comp ? 7000 : undefined);
  const list12 = validate(a, { discountPct: 0, termMonths: 12, extras: [] });
  return {
    session: ses,
    account: { id: a.id, name: a.name, arr: a.arr, seats: a.seats, plan: a.plan, contact: ses.contact },
    health: getHealth(accountId),
    strategy: {
      listPrice: list12.ok ? list12.listPrice : 0,
      target: Math.round((list12.ok ? list12.listPrice : 0) * 2 * 0.9),
      walkAway: lv.walkAway,
      leverage: lv,
      ladder: LADDER.map((r) => ({ ...r, needsApproval: r.discountPct > POLICY.approvalAbove })),
      policy: POLICY,
    },
    offer: ses.offerId ? store().offers.find((o) => o.id === ses.offerId) ?? null : null,
  };
}
