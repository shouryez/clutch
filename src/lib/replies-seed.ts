/** Inbound customer replies waiting in the inbox when the demo starts. */
import type { Account } from "./types";

export type Intent = "change_request" | "billing" | "churn_risk" | "info_request" | "contact_change" | "ready_to_sign" | "other";

export type Triage = {
  intent: Intent;
  confidence: number;
  summary: string;
  params: { seats?: number; addSeats?: number; upfront?: boolean; newContactName?: string; newContactEmail?: string; documents?: string[] };
  reply: string;
  actions: string[]; // what Clutch did, in plain English
  model: string;
  ms: number;
};

export type Reply = {
  id: string;
  accountId: string;
  accountName: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  at: number;
  status: "new" | "handling" | "handled";
  triage?: Triage;
};

const DAY = 86_400_000;

export function seedReplies(accounts: Account[], now: number): Reply[] {
  const by = (id: string) => accounts.find((a) => a.id === id);
  const raw: { id: string; contact?: (a: Account) => Account["contacts"][number] | undefined; subject: string; body: string; ago: number }[] = [
    {
      id: "dune-pharma",
      subject: "Re: Renewal — seats + payment",
      body: "Hi Meera, we're growing the support team. Can we go to 10 more seats at renewal, and pay annually upfront this time? Please also loop in our procurement team.",
      ago: 0.05,
    },
    {
      id: "kestrel-health",
      contact: (a) => a.contacts.find((c) => c.name.startsWith("Farah")) ?? a.contacts.find((c) => !c.isChampion && !c.bounced),
      subject: "Re: Delivery failed",
      body: "Hello — Kavya left the company last month. I'm Farah, I run the support team now. Please send anything about the Helpdeck renewal to me.",
      ago: 0.12,
    },
    {
      id: "juniper-edu",
      subject: "Renewal",
      body: "Honestly we're not sure we'll renew. Budgets got cut this year and half the team barely logs in. What are our options?",
      ago: 0.3,
    },
    {
      id: "cobalt-health",
      subject: "Security documents before renewal",
      body: "Before we sign the renewal our InfoSec team needs your SOC 2 report and the DPA. Can you share them?",
      ago: 0.6,
    },
    {
      id: "pallas-retail",
      contact: (a) => a.contacts.find((c) => /accounts|finance|procure/i.test(c.role)),
      subject: "Payment failed",
      body: "We got a payment failed email — our company card was reissued. Can you send a link to update it?",
      ago: 1.1,
    },
  ];
  return raw.flatMap((r, i) => {
    const a = by(r.id);
    if (!a) return [];
    const c = r.contact?.(a) ?? a.contacts.find((x) => x.isChampion && !x.bounced) ?? a.contacts.find((x) => !x.bounced) ?? a.contacts[0];
    return [{ id: `rep_seed_${i}`, accountId: a.id, accountName: a.name, fromName: c.name, fromEmail: c.email, subject: r.subject, body: r.body, at: now - r.ago * DAY, status: "new" as const }];
  });
}
