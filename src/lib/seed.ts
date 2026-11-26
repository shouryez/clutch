/**
 * The simulated SaaS world: "Helpdeck", a fictional helpdesk SaaS with 60 customer accounts.
 * Deterministic (seeded PRNG) so every demo run tells the same 8 planted stories.
 * All company and person names are fictional.
 */
import type { Account, Contact, Contract, Email, Invoice, Plan, Story, Ticket, UsageDay } from "./types";

export const PRICE: Record<Plan, number> = { Starter: 3000, Growth: 6000, Enterprise: 10000 };
export const CORE_FEATURES = ["tickets", "automations", "reports", "exports", "sla", "integrations"];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;
export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(startOfToday().getTime() + n * DAY);
const plusMonths = (d: Date, m: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
};

const FIRST = ["Aarav", "Ishaan", "Diya", "Kabir", "Anika", "Vihaan", "Saanvi", "Reyansh", "Myra", "Advait", "Tara", "Neel", "Ira", "Dev", "Zara", "Arnav", "Kiara", "Yash", "Riya", "Om", "Nisha", "Karan", "Leela", "Samar"];
const LAST = ["Sharma", "Iyer", "Reddy", "Kulkarni", "Banerjee", "Menon", "Gill", "Joshi", "Pillai", "Desai", "Chatterjee", "Bhatt", "Naidu", "Kapoor", "Sethi", "Rao", "Ghosh", "Patil"];
const PREFIX = ["Aster", "Bluefin", "Cobalt", "Deccan", "Ember", "Ferro", "Granite", "Halcyon", "Indigo", "Jasper", "Kinetic", "Lumen", "Monsoon", "Nimbus", "Onyx", "Peregrine", "Quill", "Ridge", "Saffron", "Tidal", "Umber", "Vertex", "Willow", "Zenith", "Arcadia", "Basalt", "Cedar", "Dune", "Estuary", "Fathom"];
const SUFFIX: [string, string][] = [
  ["Logistics", "Logistics"], ["Health", "Healthcare"], ["Fintech", "Financial services"], ["Retail", "Retail"],
  ["Foods", "FMCG"], ["Learning", "Education"], ["Mobility", "Mobility"], ["Insurance", "Insurance"],
  ["Media", "Media"], ["Energy", "Energy"], ["Travel", "Travel"], ["Realty", "Real estate"], ["Pharma", "Pharma"], ["Systems", "Software"],
];
const CITIES = ["Bengaluru", "Mumbai", "Pune", "Gurugram", "Hyderabad", "Chennai", "Noida", "Ahmedabad", "Kochi", "Jaipur"];
const CSMS = ["Meera Kapoor", "Arjun Rao", "Sana Qureshi"];

const GENERIC_TICKETS: [string, string, Ticket["priority"], number, string?][] = [
  ["SLA timer not pausing on weekends", "Our SLA reports look wrong because timers keep running over the weekend.", "P2", -0.3, "sla"],
  ["How do I add a new macro?", "Quick question about macros for the billing queue.", "P3", 0.2],
  ["Slack integration double-posting", "Every new ticket shows up twice in our Slack channel.", "P2", -0.35, "slack-integration"],
  ["Report filters reset on refresh", "Annoying but not blocking.", "P3", -0.1, "reports"],
  ["CSV export times out on large views", "Export of last quarter's tickets never finishes.", "P2", -0.45, "csv-export"],
  ["Love the new automations builder", "Just wanted to say the new builder saved us hours.", "P3", 0.8],
  ["Agent seat assignment question", "Can we reassign a seat from a former employee?", "P3", 0.1],
];

type Planted = {
  name: string; industry: string; city: string; plan: Plan; seats: number; story: Story;
  renewalIn: number; noticeDays: number; termMonths: number;
  util: number; trend: { drop: number; overDays: number }; features: string[];
};

const PLANTED: Planted[] = [
  { name: "Northwind Logistics", industry: "Logistics", city: "Mumbai", plan: "Enterprise", seats: 40, story: "bug-competitor", renewalIn: 42, noticeDays: 30, termMonths: 12, util: 0.85, trend: { drop: 0.4, overDays: 42 }, features: ["tickets", "automations", "exports"] },
  { name: "Kestrel Health", industry: "Healthcare", city: "Bengaluru", plan: "Growth", seats: 60, story: "champion-left", renewalIn: 75, noticeDays: 60, termMonths: 12, util: 0.8, trend: { drop: 0.15, overDays: 30 }, features: ["tickets", "automations", "reports", "sla"] },
  { name: "Orbit Fintech", industry: "Financial services", city: "Pune", plan: "Enterprise", seats: 52, story: "silent-decline", renewalIn: 95, noticeDays: 45, termMonths: 12, util: 0.82, trend: { drop: 0.42, overDays: 42 }, features: ["tickets", "exports"] },
  { name: "Pallas Retail", industry: "Retail", city: "Gurugram", plan: "Growth", seats: 50, story: "billing", renewalIn: 58, noticeDays: 30, termMonths: 12, util: 0.78, trend: { drop: 0.08, overDays: 30 }, features: ["tickets", "automations", "reports", "exports"] },
  { name: "Varuna Foods", industry: "FMCG", city: "Ahmedabad", plan: "Growth", seats: 80, story: "seat-shrink", renewalIn: 66, noticeDays: 45, termMonths: 12, util: 0.62, trend: { drop: 0.2, overDays: 60 }, features: ["tickets", "automations", "reports", "sla"] },
  { name: "Juniper Edu", industry: "Education", city: "Hyderabad", plan: "Growth", seats: 26, story: "cancel-intent", renewalIn: 110, noticeDays: 30, termMonths: 12, util: 0.7, trend: { drop: 0.25, overDays: 30 }, features: ["tickets", "exports", "reports"] },
  { name: "Atlas Robotics", industry: "Manufacturing", city: "Chennai", plan: "Growth", seats: 45, story: "expansion", renewalIn: 80, noticeDays: 45, termMonths: 12, util: 0.99, trend: { drop: -0.35, overDays: 90 }, features: ["tickets", "automations", "reports", "sla", "integrations"] },
  { name: "Meridian Labs", industry: "Software", city: "Bengaluru", plan: "Enterprise", seats: 30, story: "healthy-renewal", renewalIn: 60, noticeDays: 30, termMonths: 12, util: 0.9, trend: { drop: -0.05, overDays: 60 }, features: ["tickets", "automations", "reports", "exports", "sla", "integrations"] },
];

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function domain(name: string) {
  return `${name.toLowerCase().replace(/[^a-z]/g, "")}.in`;
}

function makeContract(renewalIn: number, termMonths: number, noticeDays: number, upliftPct: number, seats: number, plan: Plan, autoRenew: boolean): Contract {
  const end = plusDays(renewalIn);
  const start = plusMonths(end, -termMonths);
  const termWords = termMonths === 24 ? "twenty-four (24)" : "twelve (12)";
  return {
    start: iso(start),
    end: iso(end),
    termMonths,
    noticeDays,
    autoRenew,
    upliftPct,
    paymentTerms: "Net 30",
    clauses: [
      { key: "term", label: "Renewal date", value: iso(end), quote: `The Initial Term commences on the Effective Date and continues for ${termWords} months.`, page: 1 },
      { key: "seats", label: "Licensed seats", value: `${seats} × ${plan}`, quote: `Customer is licensed for ${seats} named Agent seats on the ${plan} plan (Schedule A).`, page: 2 },
      { key: "uplift", label: "Renewal uplift", value: `up to ${upliftPct}%`, quote: `Fees for any Renewal Term may increase by up to ${upliftPct}% over the fees for the preceding Term.`, page: 3 },
      { key: "payment", label: "Payment terms", value: "Net 30", quote: "Invoices are payable within thirty (30) days of the invoice date.", page: 3 },
      { key: "autorenew", label: "Auto-renew", value: autoRenew ? "Yes, 12 months" : "No", quote: autoRenew ? "This Agreement shall automatically renew for successive periods of twelve (12) months unless either party gives notice under Clause 9.2." : "This Agreement shall expire at the end of the Term unless renewed in writing by both parties.", page: 4 },
      { key: "notice", label: "Notice period", value: `${noticeDays} days`, quote: `Either party may elect not to renew by giving not less than ${noticeDays} days' written notice prior to the end of the then-current Term (Clause 9.2).`, page: 4 },
    ],
  };
}

function makeUsage(rand: () => number, seats: number, util: number, trend: { drop: number; overDays: number }): UsageDay[] {
  const out: UsageDay[] = [];
  for (let d = 179; d >= 0; d--) {
    const date = plusDays(-d);
    const dow = date.getDay();
    const weekend = dow === 0 || dow === 6 ? 0.42 : 1;
    let f = 1;
    if (d < trend.overDays) f = 1 - trend.drop * Math.min(1, (trend.overDays - d) / Math.max(1, trend.overDays - 10));
    const noise = 1 + (rand() - 0.5) * 0.14;
    const active = Math.max(0, Math.min(seats, Math.round(seats * util * f * weekend * noise)));
    out.push({ date: iso(date), activeUsers: active, events: Math.round(active * (16 + rand() * 12)) });
  }
  return out;
}

function person(rand: () => number, used: Set<string>) {
  for (;;) {
    const n = `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`;
    if (!used.has(n)) {
      used.add(n);
      return n;
    }
  }
}

function contact(name: string, role: string, dom: string, extra: Partial<Contact> = {}): Contact {
  const [f, l] = name.toLowerCase().replace(/[^a-z ]/g, "").split(" ");
  return {
    id: slug(name),
    name,
    role,
    email: `${f}.${l}@${dom}`,
    phone: "+91 98" + String(Math.abs(hash(name)) % 100000000).padStart(8, "0"),
    isChampion: false,
    isExecSponsor: false,
    lastActiveDaysAgo: 1,
    bounced: false,
    ...extra,
  };
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

function invoices(rand: () => number, arr: number, failed: number): Invoice[] {
  const q = Math.round(arr / 4);
  return [3, 2, 1, 0].map((i) => ({
    id: `inv_${Math.floor(rand() * 1e8).toString(36)}`,
    amount: q,
    status: i === 0 && failed > 0 ? "failed" : "paid",
    daysAgo: i * 91 + 5,
  }));
}

let ticketNo = 3200;

function plantedExtras(p: Planted, dom: string, used: Set<string>) {
  const contacts: Contact[] = [];
  const tickets: Ticket[] = [];
  const emails: Email[] = [];
  let failedInvoices = 0;
  const t = (x: Omit<Ticket, "id" | "number"> & { number?: number }): Ticket => {
    const number = x.number ?? ++ticketNo;
    return { id: `t${number}`, ...x, number };
  };

  switch (p.story) {
    case "bug-competitor":
      contacts.push(
        contact("Ananya Rao", "Head of Support Ops", dom, { isChampion: true, lastActiveDaysAgo: 16 }),
        contact("Rohan Mehta", "Support Manager", dom, { lastActiveDaysAgo: 0 }),
        contact("Vikram Shah", "COO", dom, { isExecSponsor: true, lastActiveDaysAgo: 40 }),
        contact("Priya Nair", "Finance Controller", dom, { lastActiveDaysAgo: 22 }),
      );
      used.add("Ananya Rao").add("Rohan Mehta");
      tickets.push(
        t({ number: 3318, subject: "CSV export times out above 10k rows", body: "Exports failing again. Third time this month and our month-end reports are blocked. Honestly, we're looking at Freshdesk.", priority: "P1", status: "open", openedDaysAgo: 19, sentiment: -0.82, competitor: "Freshdesk", topic: "csv-export" }),
        t({ subject: "Automation rule skipped two tickets", body: "Fixed after support call, thanks.", priority: "P3", status: "solved", openedDaysAgo: 48, sentiment: 0.1 }),
      );
      emails.push({ id: "e-nw-1", from: "rohan.mehta@" + dom, subject: "Re: Export issue — still broken", body: "We've been waiting almost three weeks. My team is exporting by hand. This needs to be fixed before renewal discussions.", daysAgo: 6, sentiment: -0.65 });
      break;
    case "champion-left":
      contacts.push(
        contact("Kavya Menon", "Head of Patient Support", dom, { isChampion: true, lastActiveDaysAgo: 31, bounced: true }),
        contact("Siddharth Varma", "VP Operations", dom, { isExecSponsor: true, lastActiveDaysAgo: 60 }),
        contact("Farah Khan", "Support Team Lead", dom, { lastActiveDaysAgo: 1 }),
      );
      emails.push({ id: "e-kh-1", from: "mailer-daemon@" + dom, subject: "Delivery failed: kavya.menon@" + dom, body: "550 5.1.1 The email account that you tried to reach does not exist.", daysAgo: 9, sentiment: -0.2, bounced: true });
      tickets.push(t({ subject: "Who is our account admin now?", body: "Our previous admin has left. Need to transfer ownership.", priority: "P3", status: "open", openedDaysAgo: 12, sentiment: -0.2 }));
      break;
    case "silent-decline":
      contacts.push(
        contact("Neha Bhandari", "Customer Experience Lead", dom, { isChampion: true, lastActiveDaysAgo: 9 }),
        contact("Rahul Saxena", "CTO", dom, { isExecSponsor: true, lastActiveDaysAgo: 90 }),
      );
      tickets.push(t({ subject: "Export for audit", body: "Our auditors need these exports every quarter — the large ones keep failing.", priority: "P3", status: "open", openedDaysAgo: 24, sentiment: -0.25, topic: "csv-export" }));
      break;
    case "billing":
      failedInvoices = 2;
      contacts.push(
        contact("Tanvi Arora", "Support Director", dom, { isChampion: true, lastActiveDaysAgo: 2 }),
        contact("Manish Goel", "Accounts Payable", dom, { lastActiveDaysAgo: 30 }),
      );
      tickets.push(t({ subject: "CSV just times out", body: "CSV just times out for the full quarter. Can you look?", priority: "P2", status: "open", openedDaysAgo: 11, sentiment: -0.4, topic: "csv-export" }));
      emails.push({ id: "e-pr-1", from: "billing@helpdeck.app", subject: "Payment failed — card ending 4417", body: "Your card was declined (insufficient funds). We retried twice.", daysAgo: 4, sentiment: -0.3 });
      break;
    case "seat-shrink":
      contacts.push(
        contact("Harsh Vardhan", "Consumer Care Head", dom, { isChampion: true, lastActiveDaysAgo: 3 }),
        contact("Pooja Lal", "Procurement Manager", dom, { lastActiveDaysAgo: 14 }),
      );
      tickets.push(t({ subject: "Can we reduce seats at renewal?", body: "We're consolidating the team and probably need fewer licences.", priority: "P3", status: "open", openedDaysAgo: 8, sentiment: -0.3 }));
      break;
    case "cancel-intent":
      contacts.push(contact("Aditi Kulkarni", "Student Services Lead", dom, { isChampion: true, lastActiveDaysAgo: 0 }));
      tickets.push(t({ subject: "Export failing again", body: "Third time this week. If this doesn't work we'll have to move.", priority: "P2", status: "open", openedDaysAgo: 5, sentiment: -0.6, topic: "csv-export" }));
      break;
    case "expansion":
      contacts.push(
        contact("Kunal Batra", "Head of Customer Support", dom, { isChampion: true, lastActiveDaysAgo: 0 }),
        contact("Shreya Pai", "CISO", dom, { isExecSponsor: true, lastActiveDaysAgo: 20 }),
      );
      tickets.push(
        t({ subject: "Do you support SSO?", body: "Our security team needs SAML SSO before we add 30 more agents next quarter.", priority: "P3", status: "open", openedDaysAgo: 6, sentiment: 0.35, asks: ["SSO"] }),
        t({ subject: "Seat limit reached", body: "We hit our seat limit again — two new agents can't log in.", priority: "P2", status: "open", openedDaysAgo: 3, sentiment: 0.1, asks: ["seats"] }),
      );
      break;
    case "healthy-renewal":
      contacts.push(
        contact("Isha Verma", "Support Lead", dom, { isChampion: true, lastActiveDaysAgo: 0 }),
        contact("Rakesh Pillai", "Finance Head", dom, { lastActiveDaysAgo: 18 }),
      );
      tickets.push(t({ subject: "Love the new automations builder", body: "It saved us hours this month.", priority: "P3", status: "solved", openedDaysAgo: 20, sentiment: 0.85 }));
      break;
  }
  return { contacts, tickets, emails, failedInvoices };
}

export function seedWorld(): Account[] {
  const rand = mulberry32(42);
  ticketNo = 3200;
  const used = new Set<string>();
  const accounts: Account[] = [];

  // planted stories first
  for (const p of PLANTED) {
    const dom = domain(p.name);
    const price = PRICE[p.plan];
    const arr = p.seats * price * 12;
    const ex = plantedExtras(p, dom, used);
    accounts.push({
      id: slug(p.name),
      name: p.name,
      industry: p.industry,
      city: p.city,
      plan: p.plan,
      seats: p.seats,
      pricePerSeatMonth: price,
      arr,
      csm: CSMS[accounts.length % 3],
      story: p.story,
      features: p.features,
      contacts: ex.contacts,
      contract: makeContract(p.renewalIn, p.termMonths, p.noticeDays, p.story === "healthy-renewal" ? 7 : 6, p.seats, p.plan, p.story !== "cancel-intent"),
      usage: makeUsage(rand, p.seats, p.util, p.trend),
      tickets: ex.tickets,
      emails: ex.emails,
      invoices: invoices(rand, arr, ex.failedInvoices),
      stripeSubscriptionId: `sub_${slug(p.name).replace(/-/g, "").slice(0, 10)}`,
    });
  }

  // generic accounts
  const names = new Set(accounts.map((a) => a.name));
  let exportBugs = 0;
  while (accounts.length < 60) {
    const [suf, industry] = SUFFIX[Math.floor(rand() * SUFFIX.length)];
    const name = `${PREFIX[Math.floor(rand() * PREFIX.length)]} ${suf}`;
    if (names.has(name)) continue;
    names.add(name);
    const r = rand();
    const plan: Plan = r < 0.3 ? "Starter" : r < 0.78 ? "Growth" : "Enterprise";
    const seats = 8 + Math.floor(rand() * (plan === "Enterprise" ? 110 : 70));
    const price = PRICE[plan];
    const arr = seats * price * 12;
    const dom = domain(name);
    const renewalIn = 12 + Math.floor(rand() * 340);
    const noticeDays = [30, 30, 45, 60][Math.floor(rand() * 4)];
    const drop = (rand() - 0.55) * 0.4;
    const util = 0.6 + rand() * 0.35;
    const champ = person(rand, used);
    const contacts = [
      contact(champ, ["Support Lead", "Head of CX", "Ops Manager", "Service Desk Lead"][Math.floor(rand() * 4)], dom, { isChampion: true, lastActiveDaysAgo: Math.floor(rand() * (rand() < 0.1 ? 30 : 8)) }),
      contact(person(rand, used), ["CFO", "COO", "VP Operations", "CTO"][Math.floor(rand() * 4)], dom, { isExecSponsor: true, lastActiveDaysAgo: 20 + Math.floor(rand() * 60) }),
    ];
    const tickets: Ticket[] = [];
    const nT = Math.floor(rand() * 4);
    for (let i = 0; i < nT; i++) {
      let g = GENERIC_TICKETS[Math.floor(rand() * GENERIC_TICKETS.length)];
      if (exportBugs < 3 && rand() < 0.25) g = GENERIC_TICKETS[4];
      if (g[4] === "csv-export") {
        if (exportBugs >= 3 || tickets.some((x) => x.topic === "csv-export")) continue;
        exportBugs++;
      }
      const n = ++ticketNo;
      tickets.push({ id: `t${n}`, number: n, subject: g[0], body: g[1], priority: g[2], status: g[4] === "csv-export" || rand() < 0.3 ? "open" : "solved", openedDaysAgo: 1 + Math.floor(rand() * 60), sentiment: g[3], topic: g[4] });
    }
    accounts.push({
      id: slug(name),
      name,
      industry,
      city: CITIES[Math.floor(rand() * CITIES.length)],
      plan,
      seats,
      pricePerSeatMonth: price,
      arr,
      csm: CSMS[accounts.length % 3],
      story: "none",
      features: CORE_FEATURES.filter(() => rand() < 0.62),
      contacts,
      contract: makeContract(renewalIn, rand() < 0.2 ? 24 : 12, noticeDays, 5 + Math.floor(rand() * 4), seats, plan, rand() < 0.8),
      usage: makeUsage(rand, seats, util, { drop, overDays: 30 + Math.floor(rand() * 40) }),
      tickets,
      emails: [],
      invoices: invoices(rand, arr, rand() < 0.05 ? 1 : 0),
      stripeSubscriptionId: `sub_${slug(name).replace(/-/g, "").slice(0, 10)}`,
    });
  }
  return accounts;
}

/** Usage history for an account imported later (deterministic per name). */
export function freshUsage(seats: number, util = 0.8, seedKey = "import"): UsageDay[] {
  let h = 7;
  for (const ch of seedKey) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return makeUsage(mulberry32(h), seats, util, { drop: 0, overDays: 0 });
}
