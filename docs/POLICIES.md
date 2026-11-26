# Zero-code policy hot-swap & re-audit

Business, financial and compliance rules are **data**, not code. They live in
[`config/policies.yaml`](../config/policies.yaml) and in the app at **/app/policies**.
Adding or changing a rule never needs a code edit, a rebuild or a restart.

## Four ways to add a rule (none need code)

| Way | How | What happens |
|---|---|---|
| **Rule builder** | `/app/policies` → **New rule** | Form or formula, with a live dry-run of how many accounts it would catch |
| **Config editor / upload** | `/app/policies` → **Config file** | YAML or JSON, validated as you type, applied with **Apply** or Ctrl+S |
| **The file on disk** | Edit `config/policies.yaml` in any editor and save | Clutch watches the file and picks the change up within about 1 s (measured at 16–18 ms) |
| **API** | `curl -X POST localhost:3210/api/policies/config --data-binary @policies.yaml` | Same validation; JSON is accepted and written back as readable YAML |

Then press **Re-run audit**, or use **Save & re-run audit** in the builder:

- **Newly flagged** exceptions are pinned to the top and glow orange with a **NEW** badge. Each one says whether a new or edited rule caught it, or whether the account itself changed.
- Exceptions that no longer break a rule appear as **Resolved**.
- Every run records a delta against the previous one (`+3 new · −1 resolved · 21 open`), the ARR exposed, and timing. A full audit takes about 4 ms.

## Safety

- **Atomic:** a broken file is rejected whole. The errors carry **line numbers** and *did-you-mean* hints, and the last good version keeps being enforced. The UI shows a red banner until the file is fixed.
- **Change log:** every version records who changed what and how (UI, file on disk, upload or API), for example `edited FIN-002: severity high→critical`.
- **Real enforcement:** deal-scope rules plug into the deal desk, so they bind the voice agent, chat, quotes and inbox re-quotes. A `block` rule refuses the offer and searches for the nearest compliant counter-offer. A `require_approval` rule pauses the deal for a manager.
- **Side effects on new exceptions:** `notify` posts to #renewals and `start_play` queues a play in the Inbox. Both fire once per exception, not on every audit.

## Rule format

```yaml
- id: FIN-010                       # unique
  name: Healthcare discount cap
  category: financial               # business | financial | compliance
  severity: critical                # low | medium | high | critical
  scope: deal                       # account = audit every customer · deal = every offer & call
  when: industry == "Healthcare" && discountPct > 5
  # or:  when: { all: [ { field: industry, op: eq, value: Healthcare }, { field: discountPct, op: gt, value: 5 } ] }
  message: "{{discountPct}} off for a {{industry}} customer — the cap is 5%"
  action: block                     # account: flag | notify | {type: start_play, play: champion}
                                    # deal:    flag | require_approval | block
```

- **Formulas:** `== != > >= < <= && || ! in [..]`, plus `and / or / not`.
- **Functions:** `contains lower upper len startsWith matches min max abs round between isEmpty`.
- **Money:** `50k`, `10L`, `1.2Cr`. Percent fields are plain numbers (`12` means 12%).
- **Operators in lists:** `eq neq gt gte lt lte between in not_in contains not_contains matches is_true is_false is_empty not_empty`. Symbols such as `>=` and `==` also work.
- **Fields:** 50 documented facts per account, such as ARR, risk, days to the notice deadline, seat utilisation, champion status, failed payments, uplift cap, competitor and industry. Deals add discount, term, seat change, extras and effective price per seat. The full list is in the app under **Config file → Fields**.

## 30-second demo for judges

1. Open `/app/policies`. Rule **BIZ-003 "Paying for seats they don't use"** flags 6 accounts.
2. Open `config/policies.yaml` and change line 51 from `utilization < 56` to `utilization < 60`, then save. A "Rules changed" banner appears on its own.
3. Click **Re-run audit now**. The green **What changed** card shows:
   - **Before** `utilization < 56` → **After** `utilization < 60`, with the changed number highlighted
   - **6 → 9 accounts (+3)**
   - The newly flagged accounts: **Granite Insurance, Monsoon Retail, Zenith Health**. Their rows glow **NEW** in the table below.
4. Optionally do the same in the UI: **Rules → BIZ-003 → Edit → change 56 → Save & re-run audit**. The same card appears.

Afterwards, change the value back to 56 (or restart the server) to reset.

Run the automated proof with `node scripts/policy-e2e.mjs` (21 checks).
