export type Plan = "Starter" | "Growth" | "Enterprise";

export type Contact = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  isChampion: boolean;
  isExecSponsor: boolean;
  lastActiveDaysAgo: number;
  bounced: boolean;
};

export type Clause = { key: string; label: string; value: string; quote: string; page: number };

export type Contract = {
  start: string; // ISO date
  end: string; // ISO date (renewal date)
  termMonths: number;
  noticeDays: number;
  autoRenew: boolean;
  upliftPct: number;
  paymentTerms: string;
  clauses: Clause[];
};

export type UsageDay = { date: string; activeUsers: number; events: number };

export type Ticket = {
  id: string;
  number: number;
  subject: string;
  body: string;
  priority: "P1" | "P2" | "P3";
  status: "open" | "solved";
  openedDaysAgo: number;
  sentiment: number; // -1..1
  competitor?: string;
  asks?: string[]; // feature asks e.g. SSO
  topic?: string; // cluster key for the bug radar
};

export type Email = {
  id: string;
  from: string;
  subject: string;
  body: string;
  daysAgo: number;
  sentiment: number;
  bounced?: boolean;
};

export type Invoice = { id: string; amount: number; status: "paid" | "failed" | "due"; daysAgo: number };

export type Story =
  | "bug-competitor"
  | "champion-left"
  | "silent-decline"
  | "billing"
  | "seat-shrink"
  | "cancel-intent"
  | "expansion"
  | "healthy-renewal"
  | "none";

export type Account = {
  id: string;
  name: string;
  industry: string;
  city: string;
  plan: Plan;
  seats: number;
  pricePerSeatMonth: number;
  arr: number;
  csm: string;
  story: Story;
  features: string[]; // core features in use
  contacts: Contact[];
  contract: Contract;
  usage: UsageDay[]; // oldest -> newest, 180 days
  tickets: Ticket[];
  emails: Email[];
  invoices: Invoice[];
  stripeSubscriptionId: string;
};

export type SignalKey = "usage" | "depth" | "seats" | "champion" | "support" | "sentiment" | "billing";

export type Signal = {
  key: SignalKey;
  label: string;
  weight: number;
  value: number; // 0..1 severity
  contribution: number; // weight * value, normalised
  evidence: string; // human sentence fragment
  ref?: { kind: "ticket" | "email" | "contact" | "invoice" | "usage"; id: string };
};

export type PlayKey = "touchless" | "bug" | "competitor" | "champion" | "adoption" | "billing" | "expansion" | "rightsize" | "negotiated";

export type Health = {
  risk: number; // 0..100
  tier: "critical" | "watch" | "healthy";
  upsell: number; // 0..100
  signals: Signal[];
  why: string;
  cause: PlayKey;
  daysToRenewal: number;
  daysToNotice: number; // days until notice window closes (negative = closed)
  deadlineMultiplier: number;
};

export type StepStatus = "pending" | "running" | "waiting" | "done" | "failed" | "skipped";

export type PlayStep = {
  key: string;
  label: string;
  tool: string;
  status: StepStatus;
  output?: string;
  link?: string;
  startedAt?: number;
  endedAt?: number;
  artifactId?: string;
  trace?: string[]; // what the agent is doing inside this step, line by line
};

/** A concrete thing Clutch produced: the email it wrote, the issue it filed, the quote it priced. */
export type ArtifactKind = "email" | "issue" | "slack" | "quote" | "meeting" | "billing" | "research" | "analysis";
export type Artifact = {
  id: string;
  at: number;
  kind: ArtifactKind;
  mode: "live" | "mock";
  accountId?: string;
  accountName?: string;
  runId?: string;
  play?: PlayKey;
  title: string; // email subject, issue title, ...
  to?: string; // recipients, channel
  body: string;
  meta?: [string, string][]; // key facts shown as a table
  link?: string; // in-app link (order form, value receipt, issue)
  sent?: { at: number; id: string; to: string; mode: "live" | "mock"; note?: string }; // emailed from Clutch
};

export type PlayRun = {
  id: string;
  accountId: string;
  play: PlayKey;
  title: string;
  status: "running" | "waiting" | "done" | "failed";
  steps: PlayStep[];
  startedAt: number;
  endedAt?: number;
  offerId?: string;
};

export type Offer = {
  id: string;
  accountId: string;
  listPrice: number;
  price: number;
  discountPct: number;
  termMonths: number;
  seats: number;
  extras: string[];
  status: "draft" | "sent" | "signed" | "rejected" | "needs-approval";
  createdAt: number;
  signedAt?: number;
  signedBy?: string;
  sentTo?: string; // contact id
  approvedBy?: string;
};

export type FeedTone = "neutral" | "risk" | "good" | "action";

export type FeedEvent = {
  id: string;
  at: number;
  accountId?: string;
  accountName?: string;
  kind: "play" | "step" | "deal" | "signal" | "system" | "call" | "trace";
  title: string;
  detail?: string;
  tone: FeedTone;
};

export type AccountSummary = {
  id: string;
  name: string;
  industry: string;
  plan: Plan;
  seats: number;
  arr: number;
  story: Story;
  renewalDate: string;
  health: Health;
  champion?: string;
  activeRun?: { id: string; play: PlayKey; status: PlayRun["status"]; step: string; done: number; total: number };
  renewed?: boolean;
  renewedDue?: number; // days-to-renewal when it was signed
};
