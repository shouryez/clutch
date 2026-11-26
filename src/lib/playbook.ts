/**
 * The playbook catalogue in plain English. Client-safe (no server imports):
 * the Playbooks page, the play preview and the renewals board all read from here,
 * and the step keys match the runner exactly.
 */
import type { PlayKey } from "./types";

export type System = "Clutch" | "Deal desk" | "GitHub" | "Email" | "E-sign" | "Stripe" | "Slack" | "Calendar" | "Browser" | "Voice AI" | "CRM";

export type PlayStepDoc = { key: string; label: string; system: System; does: string; human?: string };

export type PlayDoc = {
  label: string;
  title: string;
  problem: string; // the root business problem
  trigger: string; // when Clutch picks it
  outcome: string; // what "done" looks like
  steps: PlayStepDoc[];
};

const S = {
  health: { key: "health", label: "Re-check health", system: "Clutch", does: "Re-scores the account right before acting, so it never acts on stale data." },
  value: { key: "value_recap", label: "Build value receipt", system: "Clutch", does: "Works out what the product did for them — conversations, automations, hours and ₹ saved — and publishes a one-page receipt." },
  order: { key: "send_order_form", label: "Send order form", system: "Email", does: "Emails the order form and value receipt to the most active admin, with finance in copy. Skips contacts who have gone quiet or bounce." },
  sign: { key: "await_signature", label: "Customer signs", system: "E-sign", does: "Waits for the signature webhook. Nothing else happens until the customer signs.", human: "Customer signs on any device" },
  billing: { key: "billing", label: "Update billing", system: "Stripe", does: "Extends the subscription: new seats, new price, new term end. The contract record updates too." },
  slack: { key: "slack", label: "Tell the team", system: "Slack", does: "Posts a one-line summary to #renewals so the CSM knows without opening anything." },
  escalate: { key: "escalate", label: "File the blocker as P0", system: "GitHub", does: "Files the bug that is pushing them out, with the ARR it blocks across every affected account, so engineering prioritises by money." },
} satisfies Record<string, PlayStepDoc>;

export const PLAYBOOK: Record<PlayKey, PlayDoc> = {
  touchless: {
    label: "Touchless renew",
    title: "Touchless renewal",
    problem: "Healthy renewals still eat CSM hours — building quotes, chasing signatures, updating billing — 40 times a quarter.",
    trigger: "Risk under 35 and renewal within 90 days",
    outcome: "Renewed at list price plus the contractual uplift, with zero human touches.",
    steps: [
      S.health,
      S.value,
      { key: "quote", label: "Price the renewal", system: "Deal desk", does: "Prices at list plus the uplift written in their contract, then checks it against the guardrails." },
      S.order,
      S.sign,
      S.billing,
      S.slack,
    ],
  },
  competitor: {
    label: "Competitor save",
    title: "Competitor save",
    problem: "When a customer names a competitor the save window is days, not weeks — and discounts get handed out ad hoc.",
    trigger: "A competitor is named in a ticket, email or call",
    outcome: "The blocker is escalated, they get an offer inside policy, and they sign.",
    steps: [
      S.escalate,
      { key: "intel", label: "Read competitor pricing", system: "Browser", does: "Pulls the competitor's price for their seat count and works out what switching would really cost them." },
      { key: "quote", label: "Pre-approve a save offer", system: "Deal desk", does: "Prepares 10% off for 24 months plus onboarding — the most Clutch may give without a manager." },
      { key: "call", label: "Call the customer", system: "Voice AI", does: "The voice agent calls in English or Hinglish, answers questions and negotiates one step at a time on the discount ladder. Anything above 10% pings a manager.", human: "Customer on the phone · manager approves > 10%" },
      S.order,
      S.sign,
      S.billing,
      S.slack,
    ],
  },
  bug: {
    label: "Unblock",
    title: "Unblock & reassure",
    problem: "Customers rarely leave over a bug. They leave because nobody told them it was being fixed.",
    trigger: "Open P1/P2 ticket with negative tone",
    outcome: "Engineering has a P0 with ₹ attached and the customer has a date.",
    steps: [
      S.escalate,
      { key: "eta", label: "Send the customer an ETA", system: "Email", does: "Writes to the person who raised it, with the fix date and the issue number." },
      { key: "credit", label: "Goodwill credit", system: "Deal desk", does: "Adds one free month — the only credit allowed without approval." },
      S.slack,
    ],
  },
  champion: {
    label: "Re-thread",
    title: "Re-thread the account",
    problem: "The champion leaves and the renewal dies quietly. Nobody notices until the renewal email bounces.",
    trigger: "Champion inactive 14+ days or their email bounces",
    outcome: "A new stakeholder is identified, introduced and booked into a meeting.",
    steps: [
      { key: "stakeholder", label: "Find the next stakeholder", system: "CRM", does: "Ranks the remaining contacts by recent product activity and seniority to find who now owns the tool." },
      { key: "intro", label: "Exec-to-exec intro", system: "Email", does: "Sends an introduction from Helpdeck's leadership to their executive sponsor, naming the new owner." },
      { key: "meeting", label: "Book a meeting", system: "Calendar", does: "Books a 30-minute renewal check-in with the new owner." },
      S.slack,
    ],
  },
  adoption: {
    label: "Adoption rescue",
    title: "Adoption rescue",
    problem: "Seats that are paid for but unused turn into “why are we paying for this?” at renewal.",
    trigger: "Usage down 25%+ or shallow feature use",
    outcome: "They see their value, learn what they are missing, and have a QBR booked.",
    steps: [
      S.value,
      { key: "training", label: "Offer training", system: "Email", does: "Offers a free 30-minute session on the two features they don't use yet." },
      { key: "qbr", label: "Book a QBR", system: "Calendar", does: "Books a quarterly business review with their executive sponsor." },
      S.slack,
    ],
  },
  billing: {
    label: "Billing recovery",
    title: "Billing recovery",
    problem: "Involuntary churn: an expired card cancels a perfectly happy customer.",
    trigger: "Failed payments",
    outcome: "The card is updated and the failed invoices are collected.",
    steps: [
      { key: "paylink", label: "Send a payment link", system: "Stripe", does: "Emails finance a secure link to update the card." },
      { key: "confirm", label: "Card updated", system: "Stripe", does: "Waits for the card-update webhook.", human: "Customer updates the card" },
      { key: "retry", label: "Retry failed invoices", system: "Stripe", does: "Retries every failed invoice and marks them paid." },
      S.slack,
    ],
  },
  expansion: {
    label: "Expansion",
    title: "Expansion",
    problem: "Upsell signals — seat caps, SSO asks — sit in support tickets that sales never reads.",
    trigger: "Seat cap reached or a plan-gated feature asked for",
    outcome: "The renewal becomes an upgrade, with more seats on a higher plan.",
    steps: [
      { key: "detect", label: "Size the expansion", system: "Clutch", does: "Reads seat usage and feature asks to size the upgrade." },
      { key: "upgrade", label: "Move to the right plan", system: "Stripe", does: "Moves them to the plan that includes what they asked for, such as SAML SSO on Enterprise." },
      { key: "quote", label: "Upsell quote", system: "Deal desk", does: "Prices 30 more seats on the new plan, inside policy." },
      S.order,
      S.sign,
      S.billing,
      S.slack,
    ],
  },
  rightsize: {
    label: "Right-size",
    title: "Right-size & lock",
    problem: "A customer paying for 100 seats and using 50 will cancel. 55 seats on a two-year term beats losing all 100.",
    trigger: "Seat utilisation under 60%",
    outcome: "Fewer seats on a longer term — the logo stays and the revenue is protected.",
    steps: [
      { key: "size", label: "Right-size the seats", system: "Clutch", does: "Takes their 28-day peak active users plus 10% headroom." },
      { key: "quote", label: "Quote a 2-year deal", system: "Deal desk", does: "Prices the smaller seat count on a 24-month term." },
      S.order,
      S.sign,
      S.billing,
      S.slack,
    ],
  },
  negotiated: {
    label: "Close deal",
    title: "Close negotiated renewal",
    problem: "Deals agreed on a call die in the gap between “yes” and the paperwork.",
    trigger: "Terms agreed on a call or in the deal room",
    outcome: "The order form goes out within seconds of the yes.",
    steps: [S.order, S.sign, S.billing, S.slack],
  },
};

export const SYSTEM_TONE: Record<System, string> = {
  Clutch: "text-bone",
  "Deal desk": "text-signal",
  GitHub: "text-bone",
  Email: "text-bone",
  "E-sign": "text-volt",
  Stripe: "text-bone",
  Slack: "text-bone",
  Calendar: "text-bone",
  Browser: "text-bone",
  "Voice AI": "text-signal",
  CRM: "text-bone",
};
