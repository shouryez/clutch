# CLUTCH — Build Plan
### PS-BA4 · Intelligent Churn-Risk & Contract Renewal Workflow Automator for B2B SaaS

> **One line:** Clutch is an autonomous renewal team. It spots churn 90 days early, **calls the customer**, **negotiates** inside hard guardrails, **gets the contract signed**, and **updates billing** — while you sleep.
>
> **Pitch line:** *"Every renewal is a deal you have to win again. Clutch wins it."*

---

## Build status (updated 2026-11-25)

| Module | State | Where |
|---|---|---|
| Landing page (§7–8) | ✅ done | `src/app/page.tsx`, `src/components/landing/*` |
| M0 Synthetic world (60 accounts, 8 planted stories) | ✅ done | `src/lib/seed.ts` |
| M1 Contract reader | ✅ structured clauses + citations in UI · ⏳ PDF → Claude extraction needs API key | `seed.ts`, account page |
| M2 Signal engine + risk with reasons | ✅ done (compounding model, deadline pressure, upsell score) | `src/lib/risk.ts` |
| M3 Playbook engine (8 plays) | ✅ done, step-by-step runner with waits | `src/lib/runner.ts` |
| M5 Deal desk guardrails + negotiation | ✅ guardrails, leverage, offer ladder, manager approval, Hinglish · Gemini phrases replies (any ₹/% not produced by the engine → rejected) | `src/lib/dealdesk.ts`, `src/lib/negotiator.ts`, `/app/deal/[id]` |
| M7 Close (sign + billing) | ✅ in-app signature page + simulated Stripe · ⏳ Documenso/Stripe live | `/sign/[id]`, `adapters.ts` |
| M9 Revenue bug radar | ✅ done (GitHub live when `GITHUB_TOKEN` + `GITHUB_REPO` set) | `/app/radar` |
| M10 Touchless pipeline | ✅ done (~12 s end to end) | Meridian Labs |
| M11 Command center + live feed (SSE) | ✅ done | `/app`, `/api/events` |
| M4 Voice agent | ✅ **Sarvam** Saaras v4 STT (translit + codemix in parallel) + Bulbul v4-flash TTS (parallel sentence chunks, filler clips) + **Gemini 2.5 Flash** understand/phrase, number-checked against the deal desk · ~4 s per turn · browser-speech fallback | `/call/[id]`, `/api/voice/*`, `src/lib/sarvam.ts`, `src/lib/llm.ts` |
| M6 Competitor intel (Browser Use) | ⏳ cached figure in place | `adapters.competitorPricing` |
| M8 Cancel interceptor | ✅ fake Helpdeck customer app, data-aware reasons + offers, billing update, reason logged | `/helpdeck/[id]`, `src/lib/retention.ts` |

Integrations switch from SIMULATED to LIVE automatically when their env var exists:
`ANTHROPIC_API_KEY` · `SLACK_WEBHOOK_URL` · `RESEND_API_KEY` (+ `DEMO_EMAIL_TO`) · `GITHUB_TOKEN` + `GITHUB_REPO` · `STRIPE_SECRET_KEY` · `DOCUMENSO_API_KEY` · `SARVAM_API_KEY` / `DEEPGRAM_API_KEY` · `NEXT_PUBLIC_PUBLIC_URL` (tunnel URL so phones can open QR links).

### Update — product build (26 Nov)
- **Voice agent rebuilt**: `sarvam-105b-conversations` with function calling (`make_offer`, `accept_and_send_order_form`, `escalate_issue`, `compare_competitor`, `book_meeting`) — answers real questions (contract dates, SSO, plan) and negotiates only through tools; deal-desk engine enforces ladder, one step per turn, approval above 10%, hard max 15%. Gemini is the fallback brain; rules engine is the last resort.
- **Phone fixes**: AudioContext started inside the Accept tap (Android), hold-to-talk, live mic meter, Sarvam STT MIME fix, parallel transliteration → ~2.5 s per turn (STT 0.4 s · brain 0.5–1.4 s · TTS 1.5 s).
- **Product UI**: sidebar + top bar, ⌘K palette, Ask Clutch copilot (Sarvam LLM with portfolio tools), notifications; new pages Renewals (pipeline), Calls, Playbooks (autopilot), Analytics, Integrations; account page restructured.
- **Tests**: `node scripts/e2e.mjs` — 20/20 checks incl. a real-browser phone call with a fake microphone (`scripts/make-fake-mic.mjs`), agent conversation test `scripts/test-agent.mts`.

---

## 0. Table of contents
1. The insight (why we win)
2. Product overview — the 4 agents
3. Feature specs (M0 – M12)
4. System architecture
5. Data model
6. Tech stack, keys & local GPU fallbacks
7. Design system — "Ink & Signal"
8. Landing page — section-by-section
9. App screens (command center, account, live call, negotiation, cancel flow)
10. The demo script (5 min, 3 judge moments)
11. 12-hour build timeline
12. Risks & fallbacks
13. Judging criteria → how we score
14. Pitch deck outline

---

## 1. The insight

| What everyone builds | What actually happens in B2B SaaS |
|---|---|
| A churn model on a Kaggle CSV + a red/green dashboard | Customers decide to leave **~90 days before** renewal. The signals are scattered across 5 tools. |
| "Generate email" button | Renewals are run in spreadsheets. A CSM, a sales rep, deal-desk, finance and legal touch every one. It takes weeks. |
| Score = 0.81 | Nobody knows **why**, and nobody **does** anything until the cancellation window has already closed. |

**Our wedge:** don't predict churn — *close the loop*. Detection → conversation → negotiation → signature → billing, fully automated, with humans only where the AI asks for them.

**Headline metric we show:** *Touchless renewal rate* — % of renewals completed with zero human touches.

---

## 2. Product overview — four agents, one pipeline

```
   WATCH  ──────▶  CALL  ──────▶  NEGOTIATE  ──────▶  CLOSE
 (signals,       (voice agent,   (deal brain with    (Documenso e-sign,
  contracts,      Hinglish,       code guardrails,    Stripe update,
  risk + why)     live on phone)  competitor intel)   CRM + Slack)
        ▲                                                   │
        └──────── LEARN (which plays saved which accounts) ◀┘
```

Plus two always-on automations:
- **Cancel Interceptor** — in-app, the moment a user clicks "Cancel".
- **Revenue Bug Radar** — churn reasons → engineering tickets tagged with ₹ at stake.

---

## 3. Feature specs

Priority legend: **P0** must ship for demo · **P1** strong wow, ship if on time · **P2** stretch.

### M0 · Synthetic SaaS world (P0) — *everything runs on this*
We invent a B2B SaaS company: **"Helpdeck"** (a fictional helpdesk SaaS) with 60 customer accounts.

- Deterministic seeded generator (`src/lib/seed/`) → JSON store.
- Per account: company, industry, ARR (₹), seats, plan, contract (start, end, notice period, auto-renew, uplift %), contacts (champion, exec sponsor, admins), 12 months of daily usage, support tickets, email threads, invoices/payments.
- **Planted stories** (so every demo path is guaranteed):

| # | Account | Story | Expected play |
|---|---|---|---|
| 1 | Northwind Logistics | Export bug (P1 open 19 days) + ticket mentions "Freshdesk" | Call → negotiate → save |
| 2 | Kestrel Health | Champion's email bouncing, logins stopped | Multi-thread to exec sponsor |
| 3 | Orbit Fintech | Usage −42% over 6 weeks, no complaints (silent churn) | Value recap + QBR booking |
| 4 | Pallas Retail | 2 failed card payments | Dunning + billing call |
| 5 | Vanta Foods | Seats shrinking 80 → 52 | Right-size + 2-yr lock |
| 6 | Juniper Edu | Clicks "Cancel" in-app | Cancel interceptor |
| 7 | Atlas Robotics | Hitting seat limit, asks about SSO | **Upsell** |
| 8 | Meridian Labs | Healthy, renews in 60 days | **Touchless renewal** |

### M1 · Contract Reader (P0)
- Input: contract PDFs (generated with realistic clauses).
- Claude extracts → `{renewal_date, notice_days, auto_renew, uplift_pct, termination_for_convenience, payment_terms, signatories}` with **source quote + page** for each field.
- Output: per-account **deadline countdown**: *"Cancellation window closes in 12 days."*
- UI: PDF on the left, extracted fields on the right; clicking a field highlights its clause.

### M2 · Signal Engine + Risk with reasons (P0)
Signals (each normalised 0–1, each with evidence pointer):

| Signal | Source | Weight |
|---|---|---|
| Usage trend (28d vs prior 28d) | usage events | 0.22 |
| Feature depth (core features used) | usage events | 0.10 |
| Seat utilisation | seats vs active users | 0.10 |
| **Champion loss** (bounce / inactive 14d+) | email + logins | 0.18 |
| Support pain (open P1/P2 age, reopen count) | tickets | 0.14 |
| Sentiment + **competitor mention** | tickets + emails (Claude) | 0.14 |
| Billing friction (failed payments, downgrades) | invoices | 0.08 |
| Deadline pressure (days to notice window) | contract | multiplier |

- `risk = Σ wᵢ·sᵢ × deadline_multiplier`, clamped 0–100. Transparent > black box (judges can follow it).
- Claude writes the **"why" sentence** from the top-3 contributors, each linked to evidence.
- Expansion signals (seat cap hits, feature-gate hits, "SSO"/"API" asks) → **upsell score**.

### M3 · Playbook Engine (P0)
Root cause → play. Each play is a sequence of tool calls the agent runs.

| Cause | Play |
|---|---|
| Unresolved bug | Escalate to engineering with ₹ tag → call customer with ETA → credit offer |
| Champion left | Find next stakeholder → exec-to-exec intro email → book meeting (Cal.com) |
| Low adoption | Build value recap ("you saved 340 hrs") → book QBR |
| Billing friction | Payment-link email → call → retry |
| Competitor threat | Browser-agent battlecard → call → negotiate |
| Expansion | Upsell quote → call → sign |
| Healthy | Touchless renewal |

Every play run is a **timeline** on the account page (step, status, tool, output, timestamp).

### M4 · Clutch Call — the voice agent (P0, the star)
- **Incoming-call experience**: dashboard shows a QR → judge scans → phone shows a full-screen *incoming call* UI (ringtone + vibrate) → "Accept".
- Pipeline: **Pipecat** (open source) with SmallWebRTC transport (browser ↔ laptop, no telephony needed).
  - STT: Deepgram Nova-3 multilingual *or* Sarvam Saaras (Hindi/Hinglish). Local fallback: faster-whisper on the RTX 4060.
  - LLM: Claude (`claude-sonnet-5-5` for turns; tool calls into our API).
  - TTS: Sarvam Bulbul (Hindi + Indian English) / Cartesia. Local fallback: Kokoro / Kyutai Pocket TTS.
- **Language switching**: detect language per turn; if the judge answers in Hindi/Hinglish, Clutch replies in Hinglish.
- Agent context: account brief (risk reasons, usage, open tickets, contract dates, guardrails).
- Tools during the call: `get_account_brief`, `lookup_competitor_pricing`, `propose_offer` (goes through the guardrail engine), `send_order_form`, `book_meeting`, `escalate_ticket`, `log_outcome`.
- Live dashboard mirror (SSE): transcript, detected language, sentiment meter, risk score moving, current offer.
- Barge-in (interruptions) supported by Pipecat VAD.
- **Disclosure**: Clutch always introduces itself as an AI assistant.

### M5 · Negotiation Brain (P0)
- **Guardrails in code, not in the prompt** (`src/lib/dealdesk.ts`):
  - `floor_price`, `max_discount` (15%), `needs_approval_above` (10%), allowed trades.
  - LLM *proposes*; the engine *validates*; illegal offers are rejected and the model is told why.
- **Leverage score** from data: usage growth, value delivered (hours saved), switching cost (seats × migration cost), competitor price delta.
- **Concession ladder**: discount ↔ term length, ↔ case study, ↔ upfront payment, ↔ extra seats instead of price cut.
- **Strategy panel** (private, on big screen): walk-away price, target, concessions given/received, leverage meter, next move.
- Above-threshold asks → Slack approval card ("Approve 14% for Northwind? ₹6.2L ARR") → manager taps Approve → agent continues.
- **"Beat our AI" mode**: judge negotiates by text or voice.

### M6 · Competitor Intel via browser agent (P1)
- Trigger: competitor named in a ticket/email/call.
- **Browser Use** (open source) opens the competitor pricing page live (visible window on the big screen), extracts plans/prices.
- Output: battlecard → `switching cost` numbers fed into M5.
- Fallback: cached snapshot JSON if network is slow.

### M7 · Close — e-sign + billing (P0)
- Order form generated (HTML → PDF) with negotiated terms.
- **Documenso** API: create document, add signer, send link → webhook `document.completed`.
- On signed: **Stripe test mode** subscription update (price, quantity, term) → invoice → CRM update → Slack "🎉 Northwind renewed: ₹42L, 2 yrs".
- Fallback: in-app signature pad if Documenso is unreachable.

### M8 · Cancel Interceptor (P1)
- Inside the fake Helpdeck app: "Cancel subscription" → Clutch modal.
- Knows: last 30 days usage, failed exports, open tickets, contract terms.
- Asks *why* (one tap or free text) → offers a tailored save: pause, downgrade, bug-fix ETA + free month, training session.
- Applies the choice in Stripe instantly. Logs the reason for the Bug Radar.

### M9 · Revenue Bug Radar (P0 — cheap, high signal)
- Clusters churn reasons across accounts (Claude labels + grouping).
- `export-failures → 7 accounts → ₹3.0 Cr ARR at risk → P0`.
- Creates a GitHub issue (real repo) with the ₹ tag, affected accounts and quotes.

### M10 · Touchless Renewal Pipeline (P0)
For healthy accounts at T-90: value recap → quote (with contractual uplift) → email → e-sign → Stripe → CRM. Animated pipeline with a stopwatch. Target demo time: **< 40 s**.

### M11 · Command Center (P0)
- KPIs: ARR up for renewal, ARR at risk, ARR saved, touchless %, NRR.
- Renewal calendar / runway (next 120 days) with notice-window markers.
- Live agent feed (what Clutch is doing right now).
- At-risk queue sorted by `risk × ARR`.

### M12 · Stretch (P2)
- **Voice clone of the account manager** (Qwen3-TTS, 3 s sample, with consent + disclosure).
- **AI QBR avatar** (Open Avatar Chat / 3D browser avatar) presenting the value recap.
- **Customer twin**: rehearse a renewal call against a persona built from the account's tickets & emails.
- **Price-change war-game**: simulate all 60 accounts' reaction to +10% pricing → revenue forecast.
- **Learning loop**: which plays won which segments → reorder playbooks.

---

## 4. System architecture

```
                       ┌───────────────────────── Next.js 16 (App Router) ─────────────────────────┐
  Judge's phone ──QR──▶│  /call/[id]  (incoming-call UI, WebRTC mic)                               │
                       │  /            landing                                                     │
  Big screen ─────────▶│  /app         command center · accounts · live call mirror · negotiation  │
                       │  /helpdeck    fake customer app (cancel interceptor)                      │
                       │                                                                           │
                       │  /api/accounts  /api/risk  /api/plays  /api/dealdesk  /api/events (SSE)   │
                       │  /api/webhooks/documenso   /api/webhooks/stripe                           │
                       └───────▲──────────────────────────────▲──────────────────────────▲────────┘
                               │ tool calls (HTTP)            │ events                   │
                     ┌─────────┴─────────┐          ┌─────────┴────────┐       ┌─────────┴────────┐
                     │ Pipecat voice svc │          │  Agent runner    │       │  Browser Use svc │
                     │ (Python)          │          │  (Claude + tools)│       │  (Python)        │
                     │ STT ▸ Claude ▸ TTS│          └──────────────────┘       └──────────────────┘
                     └───────────────────┘
        External: Claude API · Sarvam/Deepgram · Documenso · Stripe (test) · Slack webhook · GitHub · Cal.com
        Store: JSON/SQLite seeded world (local-first; demo runs on the laptop)
        Tunnel: cloudflared → HTTPS URL (phone mic needs HTTPS; webhooks need a public URL)
```

---

## 5. Data model (TypeScript types in `src/lib/types.ts`)

```ts
Account   { id, name, industry, logo, arr, seats, plan, region, csm, health, risk, upsell }
Contract  { accountId, start, end, noticeDays, autoRenew, upliftPct, pdfUrl, clauses[] }
Contact   { id, accountId, name, role, email, phone, isChampion, lastActiveAt, bounced }
UsageDay  { accountId, date, activeUsers, events, featureMap }
Ticket    { id, accountId, priority, status, openedAt, subject, body, sentiment, competitor? }
Email     { id, accountId, from, to, at, subject, body, sentiment }
Invoice   { id, accountId, amount, status: paid|failed|due, at }
Signal    { accountId, key, value, weight, evidence: {kind, id, quote} }
PlayRun   { id, accountId, play, steps: Step[], status, startedAt }
Offer     { id, accountId, price, discountPct, termMonths, extras[], status, approvedBy? }
CallSession { id, accountId, lang, transcript[], sentiment[], outcome }
Event     { at, type, accountId, payload }   // drives the live feed via SSE
```

---

## 6. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Web | **Next.js 16** (App Router), React 19, TypeScript, Tailwind v4 | One codebase for landing + app + API |
| Motion | **Motion** (scroll-linked), **Lenis** (smooth scroll), Canvas 2D | Smooth, performant, no heavy WebGL dependency |
| AI | **Claude** via AI SDK (`claude-sonnet-5-5` voice/negotiation; `claude-haiku-5-5` for bulk extraction) | Tool use + long context for contracts |
| Voice | **Pipecat** (OSS) + SmallWebRTC; Sarvam/Deepgram STT; Sarvam/Cartesia TTS | Real-time, interruptible, Hinglish |
| Browser agent | **Browser Use** (OSS, MIT) | Live competitor research on screen |
| E-sign | **Documenso** (OSS) | Real signing link + webhook |
| Billing | **Stripe** test mode | Real subscription updates |
| Scheduling | **Cal.com** | Agent books QBRs |
| Notifications | Slack incoming webhook + interactive approve | Human-in-the-loop |
| Tunnel | cloudflared | HTTPS for phone mic + webhooks |

**Keys to collect (all free/trial):** `ANTHROPIC_API_KEY` (or AI Gateway), `SARVAM_API_KEY` and/or `DEEPGRAM_API_KEY`, `CARTESIA_API_KEY` (optional), `DOCUMENSO_API_KEY`, `STRIPE_SECRET_KEY` (test), `SLACK_WEBHOOK_URL`, `GITHUB_TOKEN`, `CALCOM_API_KEY` (optional).

**Local GPU fallbacks (RTX 4060 Laptop, 8 GB):** faster-whisper `large-v3-turbo` (STT), Kokoro-82M / Kyutai Pocket TTS (TTS). Pitch line: *"runs on an open-source voice stack — even offline."*

Every external integration sits behind an interface with a **mock adapter**, so the demo never dies because of one API.

---

## 7. Design system — "Ink & Signal"

Principles: **editorial, not dashboard-template.** Big type, asymmetric grid, mono data, real numbers, zero emoji icons, no purple gradients, no glassmorphism cards.

| Token | Hex | Use |
|---|---|---|
| `ink` | `#0B0B0A` | Base background |
| `carbon` | `#141412` | Raised surfaces |
| `line` | `#2A2925` | Hairlines, 1px borders |
| `bone` | `#EEE9DF` | Primary text, inverted sections |
| `ash` | `#8C877D` | Secondary text |
| `signal` | `#FF5A1F` | Risk, live, primary action |
| `volt` | `#D7FF3D` | Money saved, success |

Type:
- **Instrument Serif** (italic) — emotional words in headlines (*while you sleep*).
- **Geist** — UI and body. Tight tracking at display sizes (−0.04em).
- **Geist Mono** — every number, timestamp, label (`§02 / CALL`).

Motion language:
- Smooth scroll (Lenis), **scroll-pinned chapters**, line-by-line text reveals (clip/translate), number roll-ups, SVG path drawing, live waveforms, film grain overlay, custom cursor that morphs over interactive elements, magnetic CTAs, infinite marquees, section colour inversion (ink → bone).
- Everything respects `prefers-reduced-motion`.

---

## 8. Landing page — section by section

| § | Section | What happens on scroll |
|---|---|---|
| 00 | **Nav** | Wordmark, live mono ticker "ARR saved today ₹84,20,000", "Get a call" CTA |
| 01 | **Hero** — "Renewals, won *while you sleep.*" | Headline lines rise in; canvas *voice field* (concentric dotted rings pulsing like a live call, reacting to cursor); floating incoming-call card from Clutch |
| 02 | **Marquee** of signals | `CHAMPION LEFT · USAGE −42% · "LOOKING AT FRESHDESK" · CARD DECLINED · NOTICE WINDOW: 12 DAYS` |
| 03 | **The 90 days nobody watches** | Pinned horizontal timeline T-120 → T-0; signals pop in; a vermilion marker: *"This is when they decided to leave."* Then: *"You found out here."* at T-0 |
| 04 | **Four agents** | Stacking sticky cards: Watch · Call · Negotiate · Close, each with a live mini-UI |
| 05 | **The call** | Phone mock; transcript types in as you scroll; language chip flips EN → HI; sentiment meter climbs |
| 06 | **The negotiation** | Chat on the left, *private strategy* on the right: walk-away price, concession ledger, leverage bars filling |
| 07 | **Touchless** | Inverted bone section; SVG pipeline draws itself; stopwatch counts to 00:38 |
| 08 | **Bug radar** | Giant "₹3.0 Cr" rolls up; "blocked by one bug"; GitHub-issue card slides in |
| 09 | **Numbers** | 71% touchless · 90 days earlier · 0 missed notice windows |
| 10 | **CTA** — "Pick up. It's Clutch." | QR code + magnetic button; footer giant wordmark |

---

## 9. App screens

1. **Command Center** `/app` — KPI strip, renewal runway (120-day timeline), at-risk queue (risk × ARR), live agent feed.
2. **Account** `/app/accounts/[id]` — risk dial + "why" sentence with evidence chips, contract countdown, signals chart, play timeline, contacts (champion status).
3. **Live Call** `/app/call/[id]` — giant waveform, transcript, language, sentiment, current offer; QR to join.
4. **Negotiation Room** `/app/deal/[id]` — chat + strategy panel + approval state.
5. **Helpdeck (fake customer app)** `/helpdeck` — settings → billing → *Cancel* → Clutch interceptor.
6. **Phone** `/call/[id]` — incoming call → in-call UI.

UI previews (rendered from the actual code) are in `docs/ui/`:

![Hero](docs/ui/01-hero.png)
![Timeline](docs/ui/02-timeline.png)
![Agents](docs/ui/03-agents.png)
![Call](docs/ui/04-call.png)
![Negotiation](docs/ui/05-negotiation.png)
![Touchless](docs/ui/06-touchless.png)
![Bug radar](docs/ui/07-bug-radar.png)
![CTA](docs/ui/08-cta.png)

Regenerate any time with the dev server running: `node scripts/shoot.mjs http://localhost:3210`

**App screens** (rendered from the running app by `node scripts/shoot-app.mjs`, which also drives a mini demo):

![Command center](docs/ui/09-command-center.png)
![Account — Northwind](docs/ui/10-account-northwind.png)
![Play waiting for signature](docs/ui/11-play-waiting-signature.png)
![Order form on phone](docs/ui/12-sign-phone.png)
![Renewed touchlessly](docs/ui/13-play-renewed.png)
![Command center after](docs/ui/14-command-center-after.png)
![Bug radar](docs/ui/15-radar.png)

**Phase 2 — negotiation, voice, cancel interceptor** (`node scripts/shoot-phase2.mjs`):

![Deal room — approval](docs/ui/16-deal-room-approval.png)
![Deal room — agreed](docs/ui/17-deal-room-agreed.png)
![Phone — ringing](docs/ui/18-phone-ringing.png)
![Phone — in call](docs/ui/19-phone-in-call.png)
![Call mirror](docs/ui/20-call-mirror.png)
![Helpdeck billing](docs/ui/21-helpdeck-billing.png)
![Cancel — why](docs/ui/22-cancel-why.png)
![Cancel — offers](docs/ui/23-cancel-offers.png)
![Cancel — saved](docs/ui/24-cancel-saved.png)
![Command center after save](docs/ui/25-command-after-save.png)

### How the keyless voice works (and what keys change)
- Phone page uses the browser's own speech recognition (`en-IN`, which writes Hinglish in Latin script) and speech synthesis (`hi-IN` / `en-IN` voices). Chrome on Android works best; the mic needs HTTPS, so open it through the tunnel URL.
- The brain is `negotiator.ts` on the server — same code path as the text deal room, same guardrails.
- With keys: Pipecat streams audio, Sarvam/Deepgram do STT/TTS, Claude replaces the intent parsing and phrasing — and still has to call `propose()`, so the limits can't move.
- Fallback built in: a "type" button on the phone for noisy venues.

---

## 10. Demo script (5 minutes)

| Time | Beat | Fallback |
|---|---|---|
| 0:00 | Landing hero, one sentence: *"Customers decide to leave 90 days before renewal. Nobody's watching. Clutch is."* | — |
| 0:20 | Command center: ₹1.2 Cr at risk. Open **Meridian** → hit *Run touchless renewal* → pipeline completes in ~40 s while we talk | Pre-recorded clip |
| 1:00 | Open **Northwind**: risk 81, why-sentence, evidence chips, notice window 12 days | — |
| 1:30 | **Judge scans QR → phone rings → Clutch calls.** Judge complains, switches to Hindi, asks for 25% | Laptop mic + speaker |
| 2:30 | Big screen: browser agent pulls competitor pricing live; strategy panel shows walk-away; Clutch counters 12% for 2 years | Cached battlecard |
| 3:15 | Deal agreed → **signing link lands on judge's phone mid-call** → sign → Stripe updated → Slack 🎉 | In-app signature pad |
| 3:45 | Second judge: opens Helpdeck → **Cancel** → interceptor saves them | — |
| 4:15 | Bug Radar: ₹3.0 Cr blocked by one bug → GitHub issue created | — |
| 4:40 | Close: KPIs (touchless %, ARR saved). *"Every renewal is a deal you have to win again. Clutch wins it."* | — |

Record a full backup video of the demo the night before.

---

## 11. 12-hour build timeline

| Hours | Track A (web / UI) | Track B (agents / voice) |
|---|---|---|
| 0 – 1.5 | ✅ Scaffold, design system, landing page | Seed generator + planted stories |
| 1.5 – 3 | Command center + account page | Risk engine + why-sentence + contract reader |
| 3 – 6 | Live call mirror (SSE), phone incoming-call UI, QR | **Pipecat voice service** + tools + Hinglish |
| 6 – 8 | Negotiation room + strategy panel | Deal-desk guardrails + leverage + Slack approval |
| 8 – 9.5 | Touchless pipeline animation, Bug Radar | Documenso + Stripe + webhooks; GitHub issue |
| 9.5 – 10.5 | Helpdeck + cancel interceptor | Browser Use competitor intel |
| 10.5 – 12 | Polish, reduced motion, perf | Rehearse ×3, backup video, offline fallbacks |

(Solo build: run the tracks sequentially, P0 first; cut M6/M8 before cutting voice.)

---

## 12. Risks & fallbacks

| Risk | Mitigation |
|---|---|
| Venue Wi-Fi dies | Local GPU STT/TTS, cached competitor data, hotspot |
| Phone mic blocked (no HTTPS) | cloudflared HTTPS tunnel; fallback to laptop mic |
| LLM latency on voice | Short system prompt, streaming TTS, Sonnet for turns, filler phrases |
| LLM makes a bad offer | Guardrails in code; offers outside policy are impossible |
| Webhook doesn't fire | Poll Documenso/Stripe as backup; manual "simulate" button hidden in UI |
| Judges ask "is the data real?" | Be upfront: synthetic company, real integrations (Stripe test, Documenso, Slack, GitHub) |

---

## 13. Judging criteria → how we score

| Criterion | Our answer |
|---|---|
| Solves the PS exactly | Churn-risk (M2), contract renewal (M1, M10), workflow automation (M3–M7) |
| Innovation | Voice agent that negotiates under code guardrails; touchless renewals; revenue-tagged bugs |
| Technical depth | Real-time voice pipeline, tool-calling agents, webhooks, browser agent |
| Demo / UX | Judges participate 3 times; phone rings in the room |
| Business impact | ₹ saved, touchless %, NRR — numbers on every screen |
| Responsible AI | Disclosure on calls, guardrails in code, human approval above thresholds |

---

## 14. Pitch deck outline (6 slides)
1. *"Customers don't churn on renewal day."* — the 90-day chart.
2. Today's renewal process: 5 people, 5 tools, 3 weeks.
3. Clutch: Watch → Call → Negotiate → Close.
4. Live demo.
5. Architecture (open-source voice stack, guardrails in code).
6. Impact + ask.

## Update — product pass v3 (26 Nov)

- **Command center**: today's brief (spoken by Sarvam Bulbul), where-the-money-stands bar, renewal pipeline (5 stages), ARR-per-week chart (one block per account), notice-window deadlines, compact queue.
- **Play preview**: every play button opens a personalised step-by-step preview (who gets emailed, exact price, billing change) before anything runs.
- **Artifacts + Outbox**: every step leaves the real thing it produced (email, quote, GitHub issue, Slack post, billing diff, meeting). Sandbox vs delivered shown honestly.
- **Bug radar**: issue draft preview, file P0, and **fix-shipped loop** — emails every affected customer, closes tickets, re-scores risk.
- **Value receipt** (`/value/[id]`): customer-facing ROI page, linked from every order form and adoption email.
- Playbooks / Integrations / Analytics rewritten to explain what each piece does. Screens: `docs/ui/v3-*.png`. e2e: 26/26.

## Update — phase 4 (26 Nov)

- **Inbox agent** (`/app/inbox`): reads customer replies (Sarvam, ~0.7s), classifies intent (change request, billing, churn risk, documents, contact change, ready to sign), acts inside guardrails (re-quote + order form, payment link, champion swap, security pack, retention play) and replies. Approvals, "ask me" plays and manual steps live here too. Auto-handle toggle.
- **Contracts** (`/app/contracts`): all 60 contracts by notice deadline; paste an MSA → AI extracts term, notice, auto-renew, uplift, seats, price with the source sentence highlighted → "Add to Clutch" creates/updates a scored account.
- **Settings** (`/app/settings`): live guardrails (max discount, approval line) wired into the deal desk; per-play autonomy (Off / Ask me / Autopilot) that autopilot obeys; autopilot batch size.
- **Call agent**: live objection tags on the call mirror; CRM summary written automatically when the phone hangs up (money outcome always from the deal-desk log).
- **Shell**: collapsible sidebar (Ctrl \), live count badges, animated active marker, breadcrumbs, user menu, Ctrl J for Ask Clutch.
- **Landing**: ambient glow + grids on every dark section, 3D product showcase with real screenshots, feature bento with animated mini-demos, integrations orbit, pricing, full footer.
- e2e: 35/35.

## Update — donut challenge: zero-code policy hot-swap & re-audit (26 Nov)
- Rules are data in `config/policies.yaml` (YAML/JSON). Four zero-code entry points: rule builder (form + safe formula language), config editor/upload, the file on disk (watched, live in ~20 ms), and `POST /api/policies/config`.
- Engine: `src/lib/policy/` — `expr.ts` (sandboxed formula parser, ₹ suffixes), `catalog.ts` (50 typed facts), `schema.ts` (validator with line numbers + did-you-mean, compiler, evidence), `engine.ts` (hot reload, atomic apply, change log, audit diff new/open/resolved, deal-desk hook, dry-run), `templates.ts`.
- Deal-scope rules are enforced inside `dealdesk.validate()`, so they bind the voice agent, chat, quotes and inbox re-quotes; `block` returns the nearest compliant counter-offer.
- UI `/app/policies`: audit results (NEW rows glow, resolved struck through, per-rule deltas, CSV), rules by category with toggles, config editor with line-numbered errors, history (change log + audit runs). The account page shows its exceptions; the sidebar shows the open count.
- Proof: `node scripts/policy-e2e.mjs` 21/21; `node scripts/e2e.mjs` 35/35. Guide: `docs/POLICIES.md`.

## Update — donut challenge 2: one-click boardroom brief with citations (26 Nov)
- `src/lib/boardroom.ts` compiles the CURRENT run (latest audit, auto re-audit if rules changed, plus live risk scan): items processed, ARR at risk / expected loss / exposure, top-3 urgent (risk² × ARR × notice urgency × exception severity), every open exception.
- Every claim cites its record with an S-number: contract clause (clause no., page, verbatim quote), ticket, email, invoice, usage metric (date windows + values), CRM contact, policy rule (YAML line + version), audit/run log entry. The risk engine now links billing to the failed invoice.
- AI narrative (Sarvam) is rejected unless every number in it exists in the computed figures; deterministic template otherwise.
- Exports from one compiled brief: designed PDF (pdf-lib + embedded Noto Sans so ₹ renders), Markdown, CSV (summary + urgent citations + exceptions). `GET /api/boardroom/export?format=pdf|md|csv&fresh=1`.
- UI: `/app/brief` paper preview with clickable [S#] citations; one-click "Board brief" export on the command center and policies pages. Samples in `docs/brief/`.
- Proof: `node scripts/brief-e2e.mjs` 20/20; policy 21/21; main 35/35.

## Update — real email on every step + visible agent (26 Nov)
- Every play step now narrates what the agent is doing (`PlayStep.trace`, real numbers per tool) at a watchable pace (`PLAY_PACE_MS`, default 900 ms per line). Trace pulses refresh the UI without touching the activity feed.
- `src/lib/mailer.ts`: branded HTML email drafted for every artifact kind (customer email, quote, escalation, #renewals alert, meeting, billing, research, analysis) plus the policy-audit digest and the boardroom brief (PDF attached). Variables from the live account. Delivered via Resend to `DEMO_EMAIL_TO`; Resend testing mode falls back to the account owner.
- Buttons: "Email" on every step in the play timeline and every Outbox item (preview → Send real email), "Email brief + PDF" on Board brief, "Email audit" on Policies. Plays never auto-send unless `AUTO_SEND_EMAILS=1`.
