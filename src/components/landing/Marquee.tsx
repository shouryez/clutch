const rowA = [
  ["Champion left", false],
  ["Usage −42% in 6 weeks", true],
  ["“Looking at Freshdesk”", false],
  ["Card declined ×2", true],
  ["Notice window: 12 days", false],
  ["Seats 80 → 52", true],
  ["P1 open for 19 days", false],
] as const;

const rowB = [
  "Called in Hinglish",
  "Countered at 12% for 24 months",
  "Signed in 00:47",
  "Stripe updated",
  "₹42,24,000 renewed",
  "Bug tagged ₹3.0 Cr",
  "Zero humans",
];

function Sep() {
  return <span className="mx-8 inline-block h-2 w-2 rotate-45 bg-current opacity-50" />;
}

export function Marquee() {
  return (
    <section aria-label="Signals" className="relative overflow-hidden border-y border-line bg-ink py-7">
      <div className="flex w-max animate-marquee items-center whitespace-nowrap text-[clamp(1.6rem,3.4vw,3.2rem)] font-medium tracking-[-0.04em]">
        {[0, 1].map((k) => (
          <div key={k} className="flex items-center" aria-hidden={k === 1}>
            {rowA.map(([t, hot]) => (
              <span key={t} className="flex items-center">
                <span className={hot ? "text-signal" : "text-bone"}>{t}</span>
                <Sep />
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex w-max animate-marquee-rev items-center whitespace-nowrap font-mono text-[12px] uppercase tracking-[0.2em] text-ash">
        {[0, 1].map((k) => (
          <div key={k} className="flex items-center" aria-hidden={k === 1}>
            {rowB.map((t) => (
              <span key={t} className="flex items-center">
                <span className={t === "Zero humans" ? "text-volt" : ""}>{t}</span>
                <span className="mx-6">/</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
