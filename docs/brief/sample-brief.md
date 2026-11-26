# Boardroom brief — Helpdeck renewals

_Generated 26 Nov 2026, 11:01 am IST · audit #1 · policies v1 (`config/policies.yaml`) · brief `brief_mwx472ch` · fingerprint `3d78422614da3d35`_

## Executive summary

Our renewal risk review covers 60 accounts with 11597 records processed. ARR up for renewal in 120 days totals ₹9.2 Cr across 23 renewals. ARR at risk is ₹4.4 Cr across 9 accounts, with an expected loss of ₹3.2 Cr if no action is taken. Open policy exceptions stand at 15, comprising 1 critical and 5 high. The top three accounts are Northwind Logistics at ₹48 L ARR with risk 95 and an 11-day notice deadline, Kestrel Health at ₹43 L ARR with risk 62 and a 14-day notice deadline, and Halcyon Fintech at ₹1.3 Cr ARR with risk 49 and an 84-day notice deadline. Northwind shows usage down 40% in 6 weeks, an inactive champion for 16 days, and ticket #3318 referencing Freshdesk, warranting a competitor save with an escalated blocker and an in-policy offer. Kestrel Health has a bouncing champion email, usage down 16% in 6 weeks, 63% seat activity, and requires re-threading with a new stakeholder. Halcyon Fintech has an inactive champion for 27 days and 55% seat activity, also requiring re-threading with a new stakeholder identified, introduced, and booked into a meeting.

> Narrative written by sarvam-105b; every number in it was checked against the computed figures below.

| Metric | Value |
|---|---|
| Records processed | 11,597 (60 accounts · 60 contracts / 360 clauses · 10,800 usage-days · 72 tickets · 3 emails · 240 invoices · 122 contacts) |
| Policy checks run | 480 (8 rules × 60 accounts) |
| ARR under management | ₹25,21,20,000 |
| ARR renewing in 120 days | ₹9,20,88,000 (23 renewals) |
| **ARR at risk** | **₹4,36,20,000** (9 accounts) |
| **Expected loss if no action** | **₹3,20,66,400** |
| Open policy exceptions | 15 (1 critical · 5 high · 9 medium · 0 low) · ARR exposed ₹5,58,24,000 |

## Top 3 urgent exceptions

### 1. Northwind Logistics — ₹48 L ARR · risk 95/100 · notice deadline in 11 days

**Expected loss:** ₹45,60,000 · **Renews:** 2027-01-06 · **Notice by:** 2026-12-06 · Logistics

**Why it is flagged**
- Usage down 40% in 6 weeks (~25 of 95 risk points) [S1]
- Champion Ananya inactive 16 days (~21 of 95 risk points) [S2]
- Ticket #3318 mentions Freshdesk (~17 of 95 risk points) [S3]
- Renewal on 6 Jan 2027; the customer can give notice until 6 Dec 2026 [S5][S4]

**Policy exceptions**
- `BIZ-003` Paying for seats they don't use (medium) — Only 50% of 40 seats active — right-size before they ask [S6][S7]

**Recommended:** Competitor save — The blocker is escalated, they get an offer inside policy, and they sign.  
**Status:** No play started yet

### 2. Kestrel Health — ₹43 L ARR · risk 62/100 · notice deadline in 14 days

**Expected loss:** ₹26,78,400 · **Renews:** 2027-02-08 · **Notice by:** 2026-12-09 · Healthcare

**Why it is flagged**
- Champion Kavya's email is bouncing (~34 of 62 risk points) [S8]
- Usage down 16% in 6 weeks (~14 of 62 risk points) [S9]
- 63% of seats active (~8 of 62 risk points) [S10]
- Renewal on 8 Feb 2027; the customer can give notice until 9 Dec 2026 [S12][S11]

**Policy exceptions**
- `BIZ-001` Notice window closing, no champion (critical) — Notice deadline in 14 days and nobody on their side owns the renewal [S13][S14]
- `COMP-002` Regulated customer with a dead contact (high) — Healthcare customer with a bounced contact — DPA and breach notices must reach a named person [S15][S16]

**Recommended:** Re-thread — A new stakeholder is identified, introduced and booked into a meeting.  
**Status:** No play started yet

### 3. Halcyon Fintech — ₹1.3 Cr ARR · risk 49/100 · notice deadline in 84 days

**Expected loss:** ₹65,85,600 · **Renews:** 2027-03-20 · **Notice by:** 2027-02-17 · Financial services

**Why it is flagged**
- Champion Leela inactive 27 days (~31 of 49 risk points) [S17]
- 55% of seats active (~13 of 49 risk points) [S18]
- Renewal on 20 Mar 2027; the customer can give notice until 17 Feb 2027 [S20][S19]

**Policy exceptions**
- `BIZ-003` Paying for seats they don't use (medium) — Only 55% of 112 seats active — right-size before they ask [S6][S21]

**Recommended:** Re-thread — A new stakeholder is identified, introduced and booked into a meeting.  
**Status:** No play started yet

## All open exceptions (15)

| Severity | Rule | Account | Finding | Evidence | Source |
|---|---|---|---|---|---|
| critical | BIZ-001 | Kestrel Health | Notice deadline in 14 days and nobody on their side owns the renewal | daysToNotice=14 days; hasChampion=no | [S13] |
| high | BIZ-002 | Varuna Foods | ₹57.6 L renewing in 65 days with no executive sponsor | arr=₹57.6 L; daysToRenewal=65 days; hasExecSponsor=no; renewed=no | [S22] |
| high | COMP-002 | Kestrel Health | Healthcare customer with a bounced contact — DPA and breach notices must reach a named person | industry=Healthcare; championBounced=yes; bouncedContacts=1 | [S15] |
| high | BIZ-002 | Pallas Retail | ₹36 L renewing in 57 days with no executive sponsor | arr=₹36 L; daysToRenewal=57 days; hasExecSponsor=no; renewed=no | [S22] |
| high | FIN-001 | Pallas Retail | 2 failed payment(s) · ₹9 L outstanding | failedInvoices=2; daysToRenewal=57 days | [S23] |
| high | BIZ-002 | Meridian Labs | ₹36 L renewing in 59 days with no executive sponsor | arr=₹36 L; daysToRenewal=59 days; hasExecSponsor=no; renewed=no | [S22] |
| medium | BIZ-003 | Halcyon Fintech | Only 55% of 112 seats active — right-size before they ask | utilization=55%; seats=112 | [S6] |
| medium | BIZ-003 | Orbit Fintech | Only 47% of 52 seats active — right-size before they ask | utilization=47%; seats=52 | [S6] |
| medium | BIZ-003 | Varuna Foods | Only 45% of 80 seats active — right-size before they ask | utilization=45%; seats=80 | [S6] |
| medium | BIZ-003 | Saffron Logistics | Only 54% of 77 seats active — right-size before they ask | utilization=54%; seats=77 | [S6] |
| medium | BIZ-003 | Northwind Logistics | Only 50% of 40 seats active — right-size before they ask | utilization=50%; seats=40 | [S6] |
| medium | COMP-001 | Deccan Travel | 7% uplift on an auto-renewing contract — the price-change notice must go out before the window closes (18 days) | autoRenew=yes; upliftPct=7%; daysToRenewal=48 days; renewed=no | [S24] |
| medium | COMP-001 | Meridian Labs | 7% uplift on an auto-renewing contract — the price-change notice must go out before the window closes (29 days) | autoRenew=yes; upliftPct=7%; daysToRenewal=59 days; renewed=no | [S24] |
| medium | BIZ-003 | Aster Travel | Only 54% of 77 seats active — right-size before they ask | utilization=54%; seats=77 | [S6] |
| medium | COMP-001 | Granite Mobility | 7% uplift on an auto-renewing contract — the price-change notice must go out before the window closes (33 days) | autoRenew=yes; upliftPct=7%; daysToRenewal=63 days; renewed=no | [S24] |

## Sources

**[S1]** Metric — Product analytics · usage_daily · 12 Nov 2026–25 Nov 2026 vs 6 Aug 2026–30 Sept 2026  
Daily active users averaged 16.9 over the last 14 days vs 28.3 in the comparison window (-40%). 40 seats licensed.

**[S2]** CRM record — CRM contact record · Ananya Rao (champion)  
Ananya Rao, Head of Support Ops · ananya.rao@northwindlogistics.in · last active 16 days ago.

**[S3]** Support ticket — Support ticket #3318 · P1 · open · opened 19 days ago  
“CSV export times out above 10k rows” — names competitor Freshdesk.  
> “Exports failing again. Third time this month and our month-end reports are blocked. Honestly, we're looking at Freshdesk.”

**[S4]** Contract clause — Master Services Agreement · Clause 9.2 · page 4  
Notice period: 30 days — notice deadline 6 Dec 2026 (in 11 days).  
> “Either party may elect not to renew by giving not less than 30 days' written notice prior to the end of the then-current Term (Clause 9.2).”

**[S5]** Contract clause — Master Services Agreement · Clause 2.1 · page 1  
Renewal date: 2027-01-06 — renews 6 Jan 2027 (in 41 days).  
> “The Initial Term commences on the Effective Date and continues for twelve (12) months.”

**[S6]** Policy rule — Policy BIZ-003 · config/policies.yaml line 46 · rules v1  
Paying for seats they don't use: utilization < 56 && seats >= 30

**[S7]** Log entry — Audit #1 · 26 Nov 2026, 11:01 am · exception BIZ-003:northwind-logistics  
Northwind Logistics tripped BIZ-003: utilization = 50%, seats = 40.

**[S8]** CRM record — CRM contact record · Kavya Menon (champion)  
Kavya Menon, Head of Patient Support · kavya.menon@kestrelhealth.in · last active 31 days ago · email hard-bounced (likely left the company).

**[S9]** Metric — Product analytics · usage_daily · 12 Nov 2026–25 Nov 2026 vs 6 Aug 2026–30 Sept 2026  
Daily active users averaged 34.1 over the last 14 days vs 40.4 in the comparison window (-16%). 60 seats licensed.

**[S10]** Metric — Product analytics · usage_daily · last 28 days (weekdays)  
37.7 weekday active users on 60 licensed seats = 63% utilisation.

**[S11]** Contract clause — Master Services Agreement · Clause 9.2 · page 4  
Notice period: 60 days — notice deadline 9 Dec 2026 (in 14 days).  
> “Either party may elect not to renew by giving not less than 60 days' written notice prior to the end of the then-current Term (Clause 9.2).”

**[S12]** Contract clause — Master Services Agreement · Clause 2.1 · page 1  
Renewal date: 2027-02-08 — renews 8 Feb 2027 (in 74 days).  
> “The Initial Term commences on the Effective Date and continues for twelve (12) months.”

**[S13]** Policy rule — Policy BIZ-001 · config/policies.yaml line 25 · rules v1  
Notice window closing, no champion: Days to notice deadline between 0 days – 45 days AND Has a champion = no

**[S14]** Log entry — Audit #1 · 26 Nov 2026, 11:01 am · exception BIZ-001:kestrel-health  
Kestrel Health tripped BIZ-001: daysToNotice = 14 days, hasChampion = no.

**[S15]** Policy rule — Policy COMP-002 · config/policies.yaml line 91 · rules v1  
Regulated customer with a dead contact: industry in ["Healthcare", "Financial services", "Insurance", "Pharma"] && (championBounced || bouncedContacts > 0)

**[S16]** Log entry — Audit #1 · 26 Nov 2026, 11:01 am · exception COMP-002:kestrel-health  
Kestrel Health tripped COMP-002: industry = Healthcare, championBounced = yes, bouncedContacts = 1.

**[S17]** CRM record — CRM contact record · Leela Joshi (champion)  
Leela Joshi, Ops Manager · leela.joshi@halcyonfintech.in · last active 27 days ago.

**[S18]** Metric — Product analytics · usage_daily · last 28 days (weekdays)  
62.0 weekday active users on 112 licensed seats = 55% utilisation.

**[S19]** Contract clause — Master Services Agreement · Clause 9.2 · page 4  
Notice period: 30 days — notice deadline 17 Feb 2027 (in 84 days).  
> “Either party may elect not to renew by giving not less than 30 days' written notice prior to the end of the then-current Term (Clause 9.2).”

**[S20]** Contract clause — Master Services Agreement · Clause 2.1 · page 1  
Renewal date: 2027-03-20 — renews 20 Mar 2027 (in 114 days).  
> “The Initial Term commences on the Effective Date and continues for twelve (12) months.”

**[S21]** Log entry — Audit #1 · 26 Nov 2026, 11:01 am · exception BIZ-003:halcyon-fintech  
Halcyon Fintech tripped BIZ-003: utilization = 55%, seats = 112.

**[S22]** Policy rule — Policy BIZ-002 · config/policies.yaml line 37 · rules v1  
Big renewal without an exec sponsor: arr >= 30L && daysToRenewal <= 120 && !hasExecSponsor && !renewed

**[S23]** Policy rule — Policy FIN-001 · config/policies.yaml line 55 · rules v1  
Failed payment on a renewing account: failedInvoices > 0 && daysToRenewal <= 120

**[S24]** Policy rule — Policy COMP-001 · config/policies.yaml line 82 · rules v1  
Auto-renew uplift needs written notice: autoRenew && upliftPct > 6 && daysToRenewal <= 90 && !renewed

## Method

- Risk = 1 − Π(1 − wᵢ·sᵢ·2) over seven weighted signals (usage trend, feature depth, seat utilisation, champion, support pain, sentiment, billing), ×1.07–1.15 when the notice window is close.
- Expected loss = risk × ARR for every unrenewed account renewing in the next 120 days.
- Urgency rank = risk² × ARR × notice-window factor (1.5 if ≤ 15 days) × (1 + 0.15 × severity of open policy exceptions).
- Policy exceptions come from audit #1 of config/policies.yaml (rules v1); each cites the rule line and the exact values that tripped it.
- All figures are computed deterministically from source records; the narrative paragraph is AI-written and rejected if it contains any number not present in these figures.
