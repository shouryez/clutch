/**
 * Play runner: turns a root cause into a sequence of tool calls and executes it,
 * streaming every step to the live feed. Every step leaves an artifact — the
 * email it wrote, the quote it priced, the issue it filed — that can be opened.
 * Steps can wait on the outside world (a signature, a call, a card update).
 */
import { bookMeeting, competitorPricing, createIssue, sendEmail, slackPost, updateSubscription, type Mode } from "./adapters";
import { fileTopic } from "./bugs";
import { leverage, listPrice, validate } from "./dealdesk";
import { execSponsor, financeContact, nextStakeholder, orderFormRecipients, quoteParams, rightsizeSeats } from "./explain";
import { inr, inrCompact } from "./format";
import { PLAYBOOK } from "./playbook";
import { daysUntil } from "./risk";
import { emit, getAccount, getHealth, pulse, recompute, record, resolveWait, store, uid, waitFor } from "./store";
import { POLICY } from "./dealdesk";
import { usageWindows } from "./risk";
import { rules as policyRules } from "./policy/engine";
import { deliver, draftForArtifact } from "./mailer";
import type { Account, Artifact, Contact, Offer, PlayKey, PlayRun, PlayStep } from "./types";
import { valueOf } from "./value";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Ctx = {
  a: Account;
  run: PlayRun;
  opts: RunOptions;
  offer?: Offer;
  notes: Record<string, unknown>;
};
type Art = Omit<Artifact, "id" | "at" | "accountId" | "accountName" | "runId" | "play">;
type StepResult = { output: string; link?: string; mode?: Mode; artifact?: Art };
type StepDef = { key: string; label: string; tool: string; pause?: number; run: (c: Ctx) => Promise<StepResult> };

export type RunOptions = { autoSign?: boolean; autoSignAfterMs?: number; offerId?: string; autoMail?: boolean };

export const PLAY_META: Record<PlayKey, { title: string; blurb: string }> = Object.fromEntries(
  Object.entries(PLAYBOOK).map(([k, d]) => [k, { title: d.title, blurb: d.outcome }]),
) as Record<PlayKey, { title: string; blurb: string }>;

const SIGN_OFF = "Meera Kapoor\nCustomer Success, Helpdeck\n(sent by Clutch on Meera's behalf)";
const first = (c: Contact) => c.name.split(" ")[0];
const addr = (cs: (Contact | undefined)[]) => cs.filter(Boolean).map((c) => `${c!.name} <${c!.email}>`).join(", ");
const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

async function mail(to: Contact[], subject: string, body: string, meta?: [string, string][], link?: string): Promise<{ mode: Mode; artifact: Art }> {
  const r = await sendEmail({ to: to.map((c) => c.email), subject, body });
  return { mode: r.mode, artifact: { kind: "email", mode: r.mode, title: subject, to: addr(to), body, meta, link } };
}

/* ---------- shared steps ---------- */

const valueRecap: StepDef = {
  key: "value_recap",
  label: "Build value receipt",
  tool: "analytics.value",
  run: async ({ a }) => {
    await sleep(700);
    const v = valueOf(a);
    return {
      output: `${v.conversations.toLocaleString("en-IN")} conversations · ${v.hoursSaved.toLocaleString("en-IN")} agent-hours saved (≈ ${inrCompact(v.valueInr)}) in 90 days`,
      link: `/value/${a.id}`,
      artifact: {
        kind: "analysis",
        mode: "live",
        title: `Value receipt · ${a.name}`,
        body: `In the ${v.period}, ${a.name} handled ${v.conversations.toLocaleString("en-IN")} conversations on Helpdeck. ${v.automations.toLocaleString("en-IN")} automations fired, saving about ${v.hoursSaved.toLocaleString("en-IN")} agent-hours — roughly ${inrCompact(v.valueInr)} of team time against ${inrCompact(v.cost)} paid.${v.opportunity ? `\n\nNot yet used: ${v.opportunity.feature} — worth another ~${v.opportunity.hours.toLocaleString("en-IN")} hours.` : ""}`,
        meta: [
          ["Conversations", v.conversations.toLocaleString("en-IN")],
          ["Automations", v.automations.toLocaleString("en-IN")],
          ["Hours saved", v.hoursSaved.toLocaleString("en-IN")],
          ["Value vs cost", `${inrCompact(v.valueInr)} / ${inrCompact(v.cost)}`],
        ],
        link: `/value/${a.id}`,
      },
    };
  },
};

function quoteStep(play: PlayKey, label = "Price the renewal"): StepDef {
  return {
    key: "quote",
    label,
    tool: "dealdesk.validate",
    run: async (c) => {
      await sleep(600);
      const p = quoteParams(play, c.a);
      const v = validate(c.a, p);
      if (!v.ok) throw new Error(v.reasons.join("; "));
      const offer: Offer = {
        id: uid("ofr"),
        accountId: c.a.id,
        listPrice: v.listPrice,
        price: v.price,
        discountPct: p.discountPct,
        termMonths: p.termMonths,
        seats: p.seats,
        extras: p.extras,
        status: v.needsApproval ? "needs-approval" : "draft",
        createdAt: Date.now(),
      };
      store().offers.push(offer);
      c.offer = offer;
      c.run.offerId = offer.id;
      const disc = p.discountPct ? ` · −${Math.round(p.discountPct * 100)}%` : ` · +${c.a.contract.upliftPct}% uplift`;
      return {
        output: `${inr(v.price)} · ${p.seats} seats · ${p.termMonths} mo${disc} — ${v.reasons[0]}`,
        artifact: {
          kind: "quote",
          mode: "live",
          title: `Quote · ${c.a.name} · ${p.termMonths} months`,
          body: `Priced by the deal desk and checked against policy: ${v.reasons[0]}.`,
          meta: [
            ["Plan", `${c.a.plan} · ${p.seats} seats`],
            ["List (incl. uplift)", inr(v.listPrice)],
            ["Discount", p.discountPct ? `${Math.round(p.discountPct * 100)}%` : "none"],
            ["Term", `${p.termMonths} months`],
            ["Extras", p.extras.join(", ") || "—"],
            ["Price", inr(v.price)],
            ["Guardrail", v.reasons[0]],
          ],
        },
      };
    },
  };
}

const sendOrderForm: StepDef = {
  key: "send_order_form",
  label: "Send order form",
  tool: "documenso.send",
  run: async (c) => {
    if (!c.offer) throw new Error("no offer");
    const { to, cc } = orderFormRecipients(c.a);
    const v = valueOf(c.a);
    const link = `/sign/${c.offer.id}`;
    const start = fmtDate(c.a.contract.end);
    const body = `Hi ${first(to)},

Your Helpdeck renewal is ready to sign.

  Plan     ${c.a.plan} · ${c.offer.seats} seats
  Term     ${c.offer.termMonths} months, from ${start}
  Price    ${inr(c.offer.price)}${c.offer.discountPct ? ` (${Math.round(c.offer.discountPct * 100)}% off list)` : ` (includes the ${c.a.contract.upliftPct}% uplift in your contract)`}${c.offer.extras.length ? `\n  Extras   ${c.offer.extras.join(", ")}` : ""}

In the last 90 days your team handled ${v.conversations.toLocaleString("en-IN")} conversations on Helpdeck and automations saved about ${v.hoursSaved.toLocaleString("en-IN")} agent-hours. Your value receipt: /value/${c.a.id}

Review and sign — two minutes, any device:
${link}

Questions? Just reply; it comes straight to me.

${SIGN_OFF}`;
    const m = await mail([to, ...(cc ? [cc] : [])], `${c.a.name} × Helpdeck — renewal order form`, body, [["Order form", c.offer.id], ["Price", inr(c.offer.price)]], link);
    c.offer.status = "sent";
    c.offer.sentTo = to.id;
    return { output: `to ${to.name}${cc ? ` + ${cc.name}` : ""} · ${m.mode === "live" ? "email sent" : "email in sandbox"}`, link, mode: m.mode, artifact: m.artifact };
  },
};

const awaitSignature: StepDef = {
  key: "await_signature",
  label: "Customer signs",
  tool: "documenso.webhook",
  run: async (c) => {
    if (!c.offer) throw new Error("no offer");
    const offer = c.offer;
    if (c.opts.autoSign) {
      setTimeout(() => {
        if (offer.status === "sent") signOffer(offer.id, c.a.contacts.find((x) => x.id === offer.sentTo)?.name ?? "Customer");
      }, c.opts.autoSignAfterMs ?? 9000);
    }
    const by = await waitFor(`sign:${offer.id}`);
    return { output: `signed by ${by}`, link: `/sign/${offer.id}` };
  },
};

const billing: StepDef = {
  key: "billing",
  label: "Update billing",
  tool: "stripe.subscriptions.update",
  run: async (c) => {
    if (!c.offer) throw new Error("no offer");
    const seats = c.offer.seats;
    const annual = Math.round(c.offer.price / (c.offer.termMonths / 12));
    const before = { seats: c.a.seats, arr: c.a.arr, end: c.a.contract.end, plan: c.a.plan };
    const due = daysUntil(c.a.contract.end);
    const r = await updateSubscription({ id: c.a.stripeSubscriptionId, annual, termMonths: c.offer.termMonths, seats });
    // the world changes: new contract
    const end = new Date(c.a.contract.end + "T00:00:00");
    end.setMonth(end.getMonth() + c.offer.termMonths);
    c.a.contract.end = end.toISOString().slice(0, 10);
    c.a.contract.termMonths = c.offer.termMonths;
    for (const cl of c.a.contract.clauses) {
      if (cl.key === "term") cl.value = c.a.contract.end;
      if (cl.key === "seats") cl.value = `${seats} × ${c.a.plan}`;
    }
    c.a.seats = seats;
    c.a.arr = annual;
    store().renewed.set(c.a.id, { offerId: c.offer.id, touchless: c.run.play === "touchless", at: Date.now(), due });
    recompute(c.a.id);
    return {
      output: r.detail,
      mode: r.mode,
      artifact: {
        kind: "billing",
        mode: r.mode,
        title: `Subscription ${c.a.stripeSubscriptionId} updated`,
        to: "Stripe",
        body: `Renewal signed by ${c.offer.signedBy ?? "the customer"} applied to the subscription and the contract record.`,
        meta: [
          ["Seats", `${before.seats} → ${seats}`],
          ["Plan", `${before.plan} → ${c.a.plan}`],
          ["ARR", `${inr(before.arr)} → ${inr(annual)}`],
          ["Term ends", `${before.end} → ${c.a.contract.end}`],
        ],
      },
    };
  },
};

function slackStep(text: (c: Ctx) => string): StepDef {
  return {
    key: "slack",
    label: "Tell the team",
    tool: "slack.post",
    run: async (c) => {
      const t = text(c);
      const r = await slackPost(t);
      return { output: `${r.mode === "live" ? "posted" : "sandbox"}: ${t}`, mode: r.mode, artifact: { kind: "slack", mode: r.mode, title: t.replace(/^\S+ /, ""), to: "#renewals", body: t } };
    },
  };
}

function manual(key: string, label: string, tool: string, waitingText: string, link?: (c: Ctx) => string): StepDef {
  return {
    key,
    label,
    tool,
    run: async (c) => {
      const step = c.run.steps.find((s) => s.key === key)!;
      step.output = waitingText;
      step.link = link?.(c);
      const v = await waitFor(`advance:${c.run.id}`);
      return { output: v || "done", link: link?.(c) };
    },
  };
}

const escalate: StepDef = {
  key: "escalate",
  label: "File the blocker as P0",
  tool: "github.issues.create",
  run: async ({ a }) => {
    const t = a.tickets.filter((x) => x.status === "open").sort((x, y) => x.priority.localeCompare(y.priority))[0];
    if (!t) return { output: "no open blocker" };
    if (t.topic) {
      const already = store().issues.find((i) => i.topic === t.topic);
      const issue = await fileTopic(t.topic, `${a.name} play`);
      if (issue) return { output: `${already ? "linked to" : "filed"} #${issue.number} · P0 · ${inrCompact(issue.arr)} ARR across ${issue.accounts.length} accounts`, link: "/app/radar", mode: issue.mode };
    }
    const body = `Blocking ${a.name}'s renewal (${inrCompact(a.arr)} ARR).\n\n> ${t.body}\n\nFirst reported in #${t.number}, open ${t.openedDaysAgo} days.`;
    const r = await createIssue({ title: t.subject, body, labels: ["P0", "revenue-at-risk"] });
    return {
      output: `#${r.number} · P0 · ${inrCompact(a.arr)} ARR`,
      link: r.url,
      mode: r.mode,
      artifact: { kind: "issue", mode: r.mode, title: `#${r.number} ${t.subject}`, to: "helpdeck/core", body, meta: [["Labels", "P0, revenue-at-risk"]] },
    };
  },
};

/* ---------- plays ---------- */

function plays(play: PlayKey): StepDef[] {
  switch (play) {
    case "touchless":
      return [
        {
          key: "health",
          label: "Re-check health",
          tool: "signals.score",
          run: async ({ a }) => {
            await sleep(500);
            const h = getHealth(a.id);
            return {
              output: `risk ${h.risk} · no blockers · notice in ${h.daysToNotice}d`,
              artifact: { kind: "analysis", mode: "live", title: `Health check · risk ${h.risk}`, body: h.why, meta: h.signals.map((s) => [s.label, `${Math.round(s.value * 100)} · ${s.evidence}`] as [string, string]) },
            };
          },
        },
        valueRecap,
        quoteStep("touchless"),
        sendOrderForm,
        awaitSignature,
        billing,
        slackStep((c) => `✅ ${c.a.name} renewed touchlessly · ${inr(c.offer!.price)} · ${c.offer!.termMonths} mo · 0 human touches`),
      ];
    case "competitor":
      return [
        escalate,
        {
          key: "intel",
          label: "Read competitor pricing",
          tool: "browser.read",
          run: async (c) => {
            const comp = c.a.tickets.find((t) => t.competitor)?.competitor ?? "competitor";
            const p = await competitorPricing(comp);
            const lv = leverage(c.a, p.perSeatMonth);
            c.notes.leverage = lv;
            return {
              output: `${comp}: ~${inr(p.perSeatMonth)}/seat/mo · switching cost ≈ ${inrCompact(lv.migrationCost)} · ${lv.hoursSaved.toLocaleString("en-IN")} hrs saved with us`,
              mode: p.mode,
              artifact: {
                kind: "research",
                mode: p.mode,
                title: `${comp} vs Helpdeck for ${c.a.name}`,
                body: `${comp} looks ${inrCompact(Math.abs(lv.annualDelta))}/yr ${lv.annualDelta > 0 ? "cheaper" : "dearer"} on paper. Switching ${c.a.seats} seats costs about ${inrCompact(lv.migrationCost)} in migration, retraining and downtime, and gives up ${lv.hoursSaved.toLocaleString("en-IN")} hours of automations they already run. Source: ${p.source}.`,
                meta: [
                  [`${comp} price`, `${inr(p.perSeatMonth)}/seat/mo · ${p.plan}`],
                  ["Helpdeck price", `${inr(c.a.pricePerSeatMonth)}/seat/mo`],
                  ["Paper saving", `${inrCompact(lv.annualDelta)}/yr`],
                  ["Switching cost", inrCompact(lv.migrationCost)],
                  ["Walk-away price", inr(lv.walkAway)],
                ],
              },
            };
          },
        },
        quoteStep("competitor", "Pre-approve a save offer"),
        manual("call", "Call the customer", "voice.call", "ready — scan the QR to take the call", (c) => `/call/${c.a.id}`),
        sendOrderForm,
        awaitSignature,
        billing,
        slackStep((c) => `🛟 Saved ${c.a.name} from ${c.a.tickets.find((t) => t.competitor)?.competitor ?? "a competitor"} · ${inr(c.offer!.price)} · ${c.offer!.termMonths} mo`),
      ];
    case "bug":
      return [
        escalate,
        {
          key: "eta",
          label: "Send the customer an ETA",
          tool: "email.send",
          run: async ({ a }) => {
            const { to } = orderFormRecipients(a);
            const t = a.tickets.filter((x) => x.status === "open").sort((x, y) => x.priority.localeCompare(y.priority))[0];
            const issue = t?.topic ? store().issues.find((i) => i.topic === t.topic) : undefined;
            const body = `Hi ${first(to)},\n\nI saw ticket #${t?.number ?? "—"} — “${t?.subject ?? "the issue you reported"}”. I'm sorry; that's on us.\n\nEngineering has it as a P0${issue ? ` (#${issue.number})` : ""} and the fix is scheduled for Thursday. I'll email you the moment it's live, and I've added a free month to your account for the trouble.\n\n${SIGN_OFF}`;
            const m = await mail([to], "We're on it — fix ships Thursday", body, [["Ticket", `#${t?.number ?? "—"}`], ["ETA", "Thursday"]]);
            return { output: `to ${to.name} · fix ETA Thursday`, mode: m.mode, artifact: m.artifact };
          },
        },
        {
          key: "credit",
          label: "Goodwill credit",
          tool: "dealdesk.validate",
          run: async ({ a }) => {
            await sleep(400);
            const amt = a.seats * a.pricePerSeatMonth;
            return { output: `1 free month (${inr(amt)}) · within policy`, artifact: { kind: "quote", mode: "live", title: `Goodwill credit · ${a.name}`, body: "One free month applied to the next invoice. Allowed without approval.", meta: [["Credit", inr(amt)], ["Policy", "free-month · no approval needed"]] } };
          },
        },
        slackStep((c) => `🔧 ${c.a.name}: blocker escalated, customer has an ETA + 1 free month`),
      ];
    case "champion":
      return [
        {
          key: "stakeholder",
          label: "Find the next stakeholder",
          tool: "crm.contacts",
          run: async ({ a }) => {
            await sleep(600);
            const lost = a.contacts.find((x) => x.isChampion);
            const next = nextStakeholder(a);
            const ranked = [...a.contacts].sort((x, y) => Number(x.bounced) - Number(y.bounced) || x.lastActiveDaysAgo - y.lastActiveDaysAgo);
            return {
              output: `${lost?.name ?? "Champion"} has gone quiet → ${next.name} (${next.role}) is the most active user`,
              artifact: {
                kind: "analysis",
                mode: "live",
                title: `Stakeholder map · ${a.name}`,
                body: `${lost ? `${lost.name} (${lost.role}) ${lost.bounced ? "— email is bouncing, likely left" : `— inactive ${lost.lastActiveDaysAgo} days`}.` : "No champion on record."} ${next.name} now owns the tool day to day.`,
                meta: ranked.map((x) => [x.name, `${x.role} · ${x.bounced ? "bouncing" : x.lastActiveDaysAgo === 0 ? "active today" : `${x.lastActiveDaysAgo}d ago`}${x.id === next.id ? " · NEW OWNER" : ""}`] as [string, string]),
              },
            };
          },
        },
        {
          key: "intro",
          label: "Exec-to-exec intro",
          tool: "email.send",
          run: async ({ a }) => {
            const exec = execSponsor(a);
            const next = nextStakeholder(a);
            const body = `Hi ${first(exec)},\n\nI lead customer success at Helpdeck. ${a.name} has been with us since ${a.contract.start.slice(0, 4)} and your team runs ${valueOf(a).conversations.toLocaleString("en-IN")} conversations a quarter through it.\n\nWith your renewal coming up on ${fmtDate(a.contract.end)}, I'd like to make sure ${next.name.split(" ")[0]} (${next.role}) has everything they need as the new owner. Could the three of us take 30 minutes this week?\n\nBest,\nArjun Rao\nCEO, Helpdeck`;
            const m = await mail([exec, next], `Helpdeck × ${a.name}`, body);
            return { output: `from Helpdeck CEO to ${exec.name} (${exec.role}), cc ${next.name}`, mode: m.mode, artifact: m.artifact };
          },
        },
        {
          key: "meeting",
          label: "Book a meeting",
          tool: "cal.book",
          run: async ({ a }) => {
            const next = nextStakeholder(a);
            const r = await bookMeeting({ with: next.name, title: "Renewal check-in" });
            return { output: r.when, mode: r.mode, artifact: { kind: "meeting", mode: r.mode, title: `Renewal check-in · ${a.name}`, to: `${next.name}, ${execSponsor(a).name}, Meera Kapoor`, body: "30 minutes · agenda: what's working, what's blocking, renewal terms.", meta: [["When", r.when], ["Where", "Google Meet"]] } };
          },
        },
        slackStep((c) => `🧵 ${c.a.name} re-threaded after champion loss · meeting booked with ${nextStakeholder(c.a).name}`),
      ];
    case "adoption":
      return [
        valueRecap,
        {
          key: "training",
          label: "Offer training",
          tool: "email.send",
          run: async ({ a }) => {
            const missing = ["automations", "reports", "sla", "integrations", "exports"].filter((f) => !a.features.includes(f)).slice(0, 2);
            const { to } = orderFormRecipients(a);
            const v = valueOf(a);
            const body = `Hi ${first(to)},\n\nYour team handled ${v.conversations.toLocaleString("en-IN")} conversations on Helpdeck in the last 90 days — nice work. I noticed you aren't using ${missing.join(" or ") || "a few newer features"} yet.${v.opportunity ? ` Teams your size save around ${v.opportunity.hours.toLocaleString("en-IN")} hours a quarter with ${v.opportunity.feature.toLowerCase()}.` : ""}\n\nWant a free 30-minute session for your team? Pick any slot: /value/${a.id}\n\n${SIGN_OFF}`;
            const m = await mail([to], "30 minutes that could save your team hours", body, [["Features", missing.join(", ") || "—"]], `/value/${a.id}`);
            return { output: `free session on ${missing.join(" & ")} → ${to.name}`, mode: m.mode, artifact: m.artifact };
          },
        },
        {
          key: "qbr",
          label: "Book a QBR",
          tool: "cal.book",
          run: async ({ a }) => {
            const exec = execSponsor(a);
            const r = await bookMeeting({ with: exec.name, title: "QBR" });
            return { output: r.when, mode: r.mode, artifact: { kind: "meeting", mode: r.mode, title: `QBR · ${a.name}`, to: `${exec.name}, Meera Kapoor`, body: "45 minutes · value receipt, adoption plan, renewal timeline.", meta: [["When", r.when]] } };
          },
        },
        slackStep((c) => `📈 Adoption play running for ${c.a.name} · QBR booked`),
      ];
    case "billing":
      return [
        {
          key: "paylink",
          label: "Send a payment link",
          tool: "stripe.payment_links",
          run: async ({ a }) => {
            const fin = financeContact(a);
            const failed = a.invoices.filter((i) => i.status === "failed");
            const total = failed.reduce((s, i) => s + i.amount, 0);
            const body = `Hi ${first(fin)},\n\nYour last ${failed.length > 1 ? `${failed.length} payments` : "payment"} to Helpdeck (${inr(total)}) didn't go through — usually an expired card. Nothing is switched off.\n\nUpdate the card securely here (takes a minute): https://pay.helpdeck.dev/u/${a.stripeSubscriptionId}\n\nWe'll retry automatically the moment it's updated.\n\n${SIGN_OFF}`;
            const m = await mail([fin], "Quick one: update your payment method", body, [["Failed invoices", String(failed.length)], ["Amount", inr(total)]]);
            return { output: `to ${fin.name} (${fin.role})`, mode: m.mode, artifact: m.artifact };
          },
        },
        manual("confirm", "Card updated", "stripe.webhook", "waiting for card update"),
        {
          key: "retry",
          label: "Retry failed invoices",
          tool: "stripe.invoices.pay",
          run: async ({ a }) => {
            await sleep(700);
            const failed = a.invoices.filter((i) => i.status === "failed");
            failed.forEach((i) => (i.status = "paid"));
            a.emails = a.emails.filter((e) => !e.subject.startsWith("Payment failed"));
            recompute(a.id);
            const total = failed.reduce((s, i) => s + i.amount, 0);
            return { output: `${failed.length || 1} invoice(s) collected · ${inr(total)}`, artifact: { kind: "billing", mode: "mock", title: `Invoices collected · ${a.name}`, to: "Stripe", body: "Failed invoices retried after the card update.", meta: failed.map((i) => [i.id, `${inr(i.amount)} · failed → paid`] as [string, string]) } };
          },
        },
        slackStep((c) => `💳 ${c.a.name} billing recovered`),
      ];
    case "expansion":
      return [
        {
          key: "detect",
          label: "Size the expansion",
          tool: "signals.upsell",
          run: async ({ a }) => {
            await sleep(600);
            const peak = Math.max(...a.usage.slice(-28).map((d) => d.activeUsers));
            const asks = a.tickets.flatMap((t) => t.asks ?? []);
            return {
              output: `${peak}/${a.seats} seats at peak${asks.length ? ` · asked for ${asks.join(", ")}` : ""} · proposing ${a.seats} → ${a.seats + 30} seats on Enterprise`,
              artifact: { kind: "analysis", mode: "live", title: `Expansion sizing · ${a.name}`, body: `Seat cap reached and plan-gated asks in tickets — the renewal should be an upgrade, not a flat renewal.`, meta: [["Peak active", `${peak} of ${a.seats}`], ["Asks", asks.join(", ") || "—"], ["Proposal", `${a.seats + 30} seats · Enterprise`]] },
            };
          },
        },
        {
          key: "upgrade",
          label: "Move to the right plan",
          tool: "catalog.plan",
          run: async (c) => {
            await sleep(300);
            const from = c.a.plan;
            c.a.plan = "Enterprise";
            c.a.pricePerSeatMonth = 10000;
            return { output: `${from} → Enterprise (includes SAML SSO)` };
          },
        },
        quoteStep("expansion", "Upsell quote"),
        sendOrderForm,
        awaitSignature,
        billing,
        slackStep((c) => `🚀 ${c.a.name} expanded · ${inr(c.offer!.price)}/yr`),
      ];
    case "negotiated":
      return [sendOrderForm, awaitSignature, billing, slackStep((c) => `🤝 ${c.a.name} renewed after negotiation · ${inr(c.offer!.price)} · ${c.offer!.termMonths} mo`)];
    case "rightsize":
      return [
        {
          key: "size",
          label: "Right-size the seats",
          tool: "signals.seats",
          run: async ({ a }) => {
            await sleep(500);
            const active = Math.max(...a.usage.slice(-28).map((d) => d.activeUsers));
            return { output: `${active} peak active of ${a.seats} licensed → propose ${rightsizeSeats(a)} seats on 24 months` };
          },
        },
        quoteStep("rightsize", "Quote a 2-year deal"),
        sendOrderForm,
        awaitSignature,
        billing,
        slackStep((c) => `🔒 ${c.a.name} locked for 24 months · ${inr(c.offer!.price)}`),
      ];
  }
}

/* ---------- engine ---------- */

export function startPlay(accountId: string, play: PlayKey, opts: RunOptions = {}): PlayRun {
  const a = getAccount(accountId);
  if (!a) throw new Error("unknown account");
  const existing = store().runs.find((r) => r.accountId === accountId && (r.status === "running" || r.status === "waiting"));
  if (existing) return existing;

  const defs = plays(play);
  const run: PlayRun = {
    id: uid("run"),
    accountId,
    play,
    title: PLAY_META[play].title,
    status: "running",
    steps: defs.map<PlayStep>((d) => ({ key: d.key, label: d.label, tool: d.tool, status: "pending" })),
    startedAt: Date.now(),
    offerId: opts.offerId,
  };
  store().runs.push(run);
  emit({ kind: "play", accountId, accountName: a.name, title: `${PLAY_META[play].title} started`, detail: PLAY_META[play].blurb, tone: "action" });
  void execute(run, defs, { a, run, opts, notes: {} });
  return run;
}

/** Visible pace of a play: each "thought" line shows for PLAY_PACE_MS (default 900 ms) so people can follow it. */
const PACE = Number(process.env.PLAY_PACE_MS ?? 900);

/** What the agent is doing inside a step — narrated with this account's real numbers. */
function traceFor(d: StepDef, c: Ctx): string[] {
  const a = c.a;
  const h = getHealth(a.id);
  const champ = a.contacts.find((x) => x.isChampion);
  const open = a.tickets.filter((t) => t.status === "open");
  const worst = [...open].sort((x, y) => x.priority.localeCompare(y.priority))[0];
  const uw = usageWindows(a);
  const deals = (() => {
    try {
      return policyRules().filter((r) => r.enabled && r.scope === "deal").length;
    } catch {
      return 0;
    }
  })();
  switch (d.tool) {
    case "analytics.value":
      return [`Reading ${a.usage.length} days of product usage for ${a.name}`, `Counting conversations and automations in the last 90 days`, `Converting hours saved to ₹ at ₹700 per agent-hour`];
    case "dealdesk.validate":
      return [`Pricing ${a.seats} seats × ${inr(a.pricePerSeatMonth)}/month with the ${a.contract.upliftPct}% contract uplift`, `Checking guardrails: max discount ${Math.round(POLICY.maxDiscount * 100)}%, approval above ${Math.round(POLICY.approvalAbove * 100)}%`, `Checking ${deals} deal rule${deals === 1 ? "" : "s"} from config/policies.yaml`];
    case "email.send":
      return [`Choosing recipients from ${a.contacts.length} CRM contacts${champ ? ` (champion: ${champ.name}${champ.bounced ? " — bouncing" : ""})` : ""}`, `Drafting the email with ${a.name}${a.name.endsWith("s") ? "'" : "'s"} numbers and contract dates`, `Handing to the email service`];
    case "slack.post":
      return [`Summarising the situation for #renewals`, `Posting with the account link and owner (${a.csm})`];
    case "github.issues.create":
      return [`Grouping ${open.length} open ticket${open.length === 1 ? "" : "s"}${worst ? ` — worst is ${worst.priority} #${worst.number} “${worst.subject}”` : ""}`, `Totalling the ARR blocked by this bug across accounts`, `Filing the issue with the revenue attached`];
    case "browser.read":
      return [`Opening the competitor's public pricing page`, `Reading per-seat prices and plan limits`, `Comparing against ${a.name}${a.name.endsWith("s") ? "'" : "'s"} ${inr(a.pricePerSeatMonth)}/seat`];
    case "crm.contacts":
      return [`Scanning ${a.contacts.length} contacts at ${a.name}`, champ?.bounced ? `${champ.name}'s email is bouncing — looking for the next owner` : `Ranking stakeholders by role and recent activity`, `Picking who to re-thread with`];
    case "cal.book":
      return [`Checking ${a.csm}'s calendar for open slots`, `Proposing a 30-minute slot this week`, `Sending the invite`];
    case "catalog.plan":
      return [`Matching usage to the plan catalogue`, `Utilisation is ${Math.round((uw.weekdayAvg / a.seats) * 100)}% of ${a.seats} seats`, `Building the recommended plan`];
    case "signals.score":
      return [`Re-scoring 7 risk signals for ${a.name}`, `Current risk ${h.risk}/100 — ${h.why.replace(/\.$/, "")}`];
    case "signals.seats":
      return [`Reading the last 28 days of weekday logins`, `${Math.round(uw.weekdayAvg)} active of ${a.seats} licensed seats`, `Sizing seats to real usage plus headroom`];
    case "signals.upsell":
      return [`Checking seat headroom and feature asks in tickets`, `Expansion score ${h.upsell}/100`];
    case "documenso.send":
      return [`Generating the order form from the approved quote`, `Routing it for e-signature`, `Waiting for the signature link`];
    case "documenso.webhook":
      return [`Listening for the signed-document webhook`];
    case "stripe.subscriptions.update":
      return [`Opening Stripe subscription ${a.stripeSubscriptionId}`, `Applying the new seats, price and term`, `Scheduling the change for the renewal date`];
    case "stripe.payment_links":
      return [`Finding the failed invoice`, `Creating a secure payment link`, `Attaching it to the customer email`];
    case "stripe.invoices.pay":
      return [`Retrying the outstanding invoice`, `Confirming payment status`];
    default:
      return [`Running ${d.label.toLowerCase()}`];
  }
}

async function narrate(step: PlayStep, lines: string[], accountId: string) {
  for (const l of lines) {
    step.trace = [...(step.trace ?? []), l];
    pulse(accountId, l);
    await sleep(PACE);
  }
}

async function execute(run: PlayRun, defs: StepDef[], ctx: Ctx) {
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    const step = run.steps[i];
    // the offer can be swapped mid-run (e.g. terms agreed on a live call)
    if (run.offerId) ctx.offer = store().offers.find((o) => o.id === run.offerId) ?? ctx.offer;
    step.status = d.key === "await_signature" || d.tool === "voice.call" || d.tool === "stripe.webhook" ? "waiting" : "running";
    run.status = step.status === "waiting" ? "waiting" : "running";
    step.startedAt = Date.now();
    if (step.status === "waiting") emit({ kind: "step", accountId: ctx.a.id, accountName: ctx.a.name, title: step.label, detail: "waiting on the customer…", tone: "action" });
    else await narrate(step, traceFor(d, ctx), ctx.a.id);
    try {
      const r = await d.run(ctx);
      step.status = "done";
      step.output = r.output;
      step.link = r.link ?? step.link;
      // the step's artifact: returned directly, or recorded by a shared service during the step (e.g. the bug radar filing)
      const art = r.artifact
        ? record({ ...r.artifact, accountId: ctx.a.id, accountName: ctx.a.name, runId: run.id, play: run.play })
        : store().artifacts.find((x) => x.at >= (step.startedAt ?? 0) && !x.runId && (x.accountId === ctx.a.id || x.kind === "issue"));
      if (art) {
        if (!art.runId) Object.assign(art, { runId: run.id, play: run.play, accountId: art.accountId ?? ctx.a.id, accountName: art.accountName ?? ctx.a.name });
        step.artifactId = art.id;
        // the agent emails what it produced, live, and the step shows it
        if (ctx.opts.autoMail !== false && process.env.RESEND_API_KEY && process.env.DEMO_EMAIL_TO) {
          const d = draftForArtifact(art);
          step.trace = [...(step.trace ?? []), `✉ Emailing “${d.subject}” (${d.scenario})…`];
          pulse(ctx.a.id);
          const m = await deliver(d);
          if (m.ok) {
            art.sent = { at: Date.now(), id: m.id!, to: m.to!, mode: "live", note: m.note };
            step.trace = [...step.trace, `✓ Email delivered to ${m.to}`];
          } else step.trace = [...step.trace, `✕ Email failed: ${m.error}`];
          pulse(ctx.a.id);
        }
      }
      step.endedAt = Date.now();
      run.status = "running";
      emit({ kind: "step", accountId: ctx.a.id, accountName: ctx.a.name, title: `✓ ${step.label}`, detail: r.output, tone: d.key === "billing" ? "good" : "neutral" });
      await sleep(d.pause ?? 650);
    } catch (e) {
      step.status = "failed";
      step.output = (e as Error).message;
      run.status = "failed";
      run.endedAt = Date.now();
      emit({ kind: "play", accountId: ctx.a.id, accountName: ctx.a.name, title: `${run.title} failed at “${step.label}”`, detail: step.output, tone: "risk" });
      return;
    }
  }
  run.status = "done";
  run.endedAt = Date.now();
  const secs = Math.round((run.endedAt - run.startedAt) / 1000);
  emit({
    kind: "play",
    accountId: ctx.a.id,
    accountName: ctx.a.name,
    title: ctx.offer?.status === "signed" ? `${ctx.a.name} renewed · ${inr(ctx.offer.price)}` : `${run.title} complete`,
    detail: `${run.steps.length} steps in ${secs}s · 0 human touches${ctx.offer?.signedBy ? ` · signed by ${ctx.offer.signedBy}` : ""}`,
    tone: "good",
  });
}

export function signOffer(offerId: string, name: string) {
  const offer = store().offers.find((o) => o.id === offerId);
  if (!offer || offer.status === "signed") return offer;
  offer.status = "signed";
  offer.signedAt = Date.now();
  offer.signedBy = name;
  const a = getAccount(offer.accountId)!;
  emit({ kind: "deal", accountId: a.id, accountName: a.name, title: `Order form signed by ${name}`, detail: `${inr(offer.price)} · ${offer.termMonths} months`, tone: "good" });
  resolveWait(`sign:${offerId}`, name);
  return offer;
}

export function listPriceFor(accountId: string) {
  const a = getAccount(accountId);
  return a ? listPrice(a) : 0;
}
