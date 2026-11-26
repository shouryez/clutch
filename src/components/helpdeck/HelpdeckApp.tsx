"use client";

/**
 * "Helpdeck" — the fictional SaaS product whose customers Clutch protects.
 * This is the customer's view: Settings → Billing → Cancel subscription,
 * where Clutch's interceptor takes over.
 */
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { inr } from "@/lib/format";
import type { cancelContext, Reason, SaveOffer } from "@/lib/retention";

type Ctx = NonNullable<ReturnType<typeof cancelContext>>;
type Step = "closed" | "why" | "offers" | "saved" | "confirm" | "cancelled";

const ease = [0.16, 1, 0.3, 1] as const;

function Logo() {
  return (
    <span className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.03em] text-[#14171f]">
      <span className="grid h-6 w-6 place-items-center rounded-md bg-[#2f5bff] text-[13px] text-white">h</span>
      helpdeck
    </span>
  );
}

function invoiceDate(renewal: string, i: number) {
  const d = new Date(renewal + "T00:00:00");
  d.setMonth(d.getMonth() - 3 * (i + 1));
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const NAV = ["Inbox", "Views", "Automations", "Reports", "Knowledge base", "Settings"];

export function HelpdeckApp({ id }: { id: string }) {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [step, setStep] = useState<Step>("closed");
  const [reason, setReason] = useState<Reason | null>(null);
  const [offers, setOffers] = useState<SaveOffer[]>([]);
  const [chosen, setChosen] = useState<SaveOffer | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch(`/api/helpdeck/${id}`)
      .then((r) => r.json())
      .then((c: Ctx) => {
        setCtx(c);
        return c;
      });
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const api = (body: object) => fetch(`/api/helpdeck/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

  if (!ctx) return <div className="min-h-screen bg-[#f6f5f2]" />;
  const a = ctx.account;
  const status = ctx.churned ? "Cancelled" : ctx.saved ? "Active · retention offer applied" : "Active";

  const openCancel = () => {
    setReason(ctx.likely);
    setStep("why");
  };
  const toOffers = async () => {
    if (!reason) return;
    setBusy(true);
    const r = (await api({ action: "offers", reason })) as { offers: SaveOffer[] };
    setOffers(r.offers);
    setBusy(false);
    setStep("offers");
  };
  const accept = async (o: SaveOffer) => {
    setBusy(true);
    await api({ action: "save", reason, offerKey: o.key, note });
    setChosen(o);
    setBusy(false);
    setStep("saved");
    void load();
  };
  const cancel = async () => {
    setBusy(true);
    await api({ action: "cancel", reason, note });
    setBusy(false);
    setStep("cancelled");
    void load();
  };

  return (
    <div className="min-h-screen bg-[#f6f5f2] font-sans text-[#14171f]">
      {/* top bar */}
      <header className="flex h-14 items-center justify-between border-b border-black/[0.07] bg-white px-5">
        <div className="flex items-center gap-8">
          <Logo />
          <span className="hidden rounded-md bg-black/[0.04] px-2.5 py-1 text-[13px] text-black/60 sm:block">{a.name}</span>
        </div>
        <div className="flex items-center gap-3 text-[13px] text-black/60">
          <span className="hidden sm:block">{ctx.user.name}</span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#14171f] text-[12px] font-medium text-white">
            {ctx.user.name.split(" ").map((x) => x[0]).join("")}
          </span>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden w-56 shrink-0 border-r border-black/[0.07] bg-white px-3 py-5 md:block" style={{ minHeight: "calc(100vh - 3.5rem)" }}>
          {NAV.map((n) => (
            <div key={n} className={`rounded-lg px-3 py-2 text-[14px] ${n === "Settings" ? "bg-[#2f5bff]/[0.08] font-medium text-[#2f5bff]" : "text-black/60"}`}>
              {n}
            </div>
          ))}
        </aside>

        <main className="flex-1 px-5 py-8 md:px-12">
          <div className="text-[13px] text-black/45">Settings / Billing</div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em]">Plan & billing</h1>

          <div className="mt-8 grid max-w-5xl gap-5 lg:grid-cols-3">
            <section className="rounded-2xl border border-black/[0.07] bg-white p-6 lg:col-span-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[13px] text-black/45">Current plan</div>
                  <div className="mt-1 text-[22px] font-semibold tracking-[-0.02em]">{a.plan}</div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${ctx.churned ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>{status}</span>
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-y-4 text-[14px] sm:grid-cols-4">
                {[
                  ["Agent seats", String(a.seats)],
                  ["Per seat", `${inr(a.pricePerSeatMonth)}/mo`],
                  ["Annual", inr(a.arr)],
                  ["Renews", new Date(ctx.renewal.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[12.5px] text-black/45">{k}</dt>
                    <dd className="mt-0.5 font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="rounded-2xl border border-black/[0.07] bg-white p-6">
              <div className="text-[13px] text-black/45">Payment method</div>
              <div className="mt-2 text-[15px] font-medium">Visa •••• 4417</div>
              <div className="text-[13px] text-black/45">Expires 08/28</div>
              <button className="mt-5 rounded-lg border border-black/10 px-3 py-1.5 text-[13px]">Update</button>
            </section>
            <section className="rounded-2xl border border-black/[0.07] bg-white p-6 lg:col-span-3">
              <div className="text-[13px] text-black/45">Invoices</div>
              <div className="mt-3 divide-y divide-black/[0.06] text-[14px]">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex justify-between py-2.5">
                    <span>{invoiceDate(ctx.renewal.date, i)}</span>
                    <span className="text-black/60">{inr(a.arr / 4)}</span>
                    <span className="text-emerald-700">Paid</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="mt-5 max-w-5xl rounded-2xl border border-red-200 bg-white p-6">
            <div className="text-[15px] font-semibold">Cancel subscription</div>
            <p className="mt-1 text-[14px] text-black/55">Your workspace stays available until the end of your current term.</p>
            {ctx.churned ? (
              <button onClick={async () => { await api({ action: "reset" }); void load(); }} className="mt-4 text-[13px] text-black/45 underline">
                Reset demo
              </button>
            ) : (
              <button onClick={openCancel} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-red-700">
                Cancel subscription
              </button>
            )}
            {ctx.saved && !ctx.churned && (
              <button onClick={async () => { await api({ action: "reset" }); void load(); }} className="ml-4 text-[13px] text-black/45 underline">
                reset demo
              </button>
            )}
          </section>
        </main>
      </div>

      {/* ---------- the interceptor ---------- */}
      <AnimatePresence>
        {step !== "closed" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-[#14171f]/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ y: 30, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.5, ease }}
              className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-[0_40px_120px_-20px_rgba(0,0,0,0.35)]"
            >
              <button onClick={() => setStep("closed")} className="absolute right-5 top-4 text-[20px] text-black/35 hover:text-black" aria-label="Close">
                ×
              </button>
              <AnimatePresence mode="wait">
                {step === "why" && (
                  <motion.div key="why" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-8">
                    <div className="text-[13px] text-black/45">Before you go, {ctx.user.name.split(" ")[0]}</div>
                    <h2 className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.03em]">We noticed a few things this month.</h2>
                    <div className="mt-5 flex flex-wrap gap-2 text-[13px]">
                      {ctx.facts.exportFailures > 0 && (
                        <span className="rounded-full bg-red-50 px-3 py-1.5 text-red-700">
                          Exports failed {ctx.facts.exportFailures}× {ctx.facts.exportTicket ? `(ticket #${ctx.facts.exportTicket})` : ""}
                        </span>
                      )}
                      <span className="rounded-full bg-black/[0.04] px-3 py-1.5 text-black/70">{ctx.facts.ticketsHandled90d.toLocaleString("en-IN")} tickets handled in 90 days</span>
                      <span className="rounded-full bg-black/[0.04] px-3 py-1.5 text-black/70">
                        {ctx.facts.activePeak} of {a.seats} seats active
                      </span>
                      {ctx.facts.usageChangePct < -5 && <span className="rounded-full bg-black/[0.04] px-3 py-1.5 text-black/70">usage {ctx.facts.usageChangePct}%</span>}
                    </div>
                    <div className="mt-7 text-[14px] font-medium">What&apos;s the main reason?</div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {ctx.reasons.map((r) => (
                        <button
                          key={r.key}
                          onClick={() => setReason(r.key)}
                          className={`rounded-xl border px-4 py-3 text-left text-[14px] transition ${reason === r.key ? "border-[#2f5bff] bg-[#2f5bff]/[0.06] text-[#14171f]" : "border-black/10 text-black/70 hover:border-black/25"}`}
                        >
                          {r.label}
                          {r.key === ctx.likely && <span className="ml-2 text-[11px] text-[#2f5bff]">likely</span>}
                        </button>
                      ))}
                    </div>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else we should know? (optional)" className="mt-4 h-20 w-full resize-none rounded-xl border border-black/10 p-3 text-[14px] outline-none focus:border-black/30" />
                    <div className="mt-6 flex items-center justify-between">
                      <span className="text-[11.5px] text-black/35">retention by clutch.</span>
                      <button disabled={!reason || busy} onClick={toOffers} className="rounded-xl bg-[#14171f] px-5 py-2.5 text-[14px] font-medium text-white disabled:opacity-40">
                        Continue
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === "offers" && (
                  <motion.div key="offers" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-8">
                    <div className="text-[13px] text-black/45">{ctx.reasons.find((r) => r.key === reason)?.label}</div>
                    <h2 className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.03em]">Here&apos;s what we can do right now.</h2>
                    <div className="mt-6 space-y-3">
                      {offers.map((o, i) => (
                        <motion.div
                          key={o.key}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08, ease }}
                          className={`rounded-2xl border p-5 ${o.tag ? "border-[#2f5bff]/40 bg-[#2f5bff]/[0.04]" : "border-black/10"}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              {o.tag && <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2f5bff]">{o.tag}</div>}
                              <div className="mt-0.5 text-[17px] font-semibold tracking-[-0.02em]">{o.title}</div>
                              <p className="mt-1 text-[14px] leading-relaxed text-black/60">{o.detail}</p>
                              <div className="mt-2 text-[12.5px] text-black/45">{o.impact}</div>
                            </div>
                            <button disabled={busy} onClick={() => accept(o)} className={`shrink-0 rounded-xl px-4 py-2 text-[14px] font-medium ${o.tag ? "bg-[#2f5bff] text-white" : "border border-black/15"}`}>
                              {busy ? "…" : "Accept"}
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    <div className="mt-6 flex items-center justify-between">
                      <button onClick={() => setStep("why")} className="text-[13px] text-black/45 hover:text-black">← Back</button>
                      <button onClick={() => setStep("confirm")} className="text-[13px] text-black/45 underline hover:text-red-600">No thanks, cancel anyway</button>
                    </div>
                  </motion.div>
                )}

                {step === "saved" && chosen && (
                  <motion.div key="saved" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="p-10 text-center">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-2xl text-white">
                      ✓
                    </motion.div>
                    <h2 className="mt-5 text-[26px] font-semibold tracking-[-0.03em]">Done — glad you&apos;re staying.</h2>
                    <p className="mx-auto mt-2 max-w-md text-[15px] text-black/60">
                      {chosen.title}. {chosen.impact}. Your billing is already updated — nothing else to do.
                    </p>
                    <button onClick={() => setStep("closed")} className="mt-6 rounded-xl bg-[#14171f] px-5 py-2.5 text-[14px] font-medium text-white">
                      Back to Helpdeck
                    </button>
                  </motion.div>
                )}

                {step === "confirm" && (
                  <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-8">
                    <h2 className="text-[24px] font-semibold tracking-[-0.03em]">Cancel {a.name}&apos;s subscription?</h2>
                    <p className="mt-2 text-[14.5px] text-black/60">
                      Your workspace stays active until {new Date(ctx.renewal.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}. After that, {a.seats} agents lose access.
                    </p>
                    <div className="mt-7 flex justify-end gap-3">
                      <button onClick={() => setStep("offers")} className="rounded-xl border border-black/15 px-4 py-2 text-[14px]">Keep my plan</button>
                      <button disabled={busy} onClick={cancel} className="rounded-xl bg-red-600 px-4 py-2 text-[14px] font-medium text-white">Confirm cancellation</button>
                    </div>
                  </motion.div>
                )}

                {step === "cancelled" && (
                  <motion.div key="cancelled" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-10 text-center">
                    <h2 className="text-[24px] font-semibold tracking-[-0.03em]">Your subscription is cancelled.</h2>
                    <p className="mt-2 text-[14.5px] text-black/60">Thanks for the feedback — it went straight to the product team.</p>
                    <button onClick={() => setStep("closed")} className="mt-6 rounded-xl border border-black/15 px-5 py-2.5 text-[14px]">Close</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
