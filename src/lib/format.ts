const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹42,24,000 */
export function inr(n: number) {
  return `₹${inrFmt.format(Math.round(n))}`;
}

/** ₹2.3 Cr / ₹42 L — compact Indian notation */
export function inrCompact(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n >= 1e8 ? 0 : 1)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(n >= 1e6 ? 0 : 1)} L`;
  return inr(n);
}
