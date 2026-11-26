import { lastAudit } from "@/lib/policy/engine";
import { deliver, draftExceptions } from "@/lib/mailer";
import { emit } from "@/lib/store";

/** Email the latest audit's exceptions (new ones first). */
export async function POST() {
  const a = lastAudit();
  const d = draftExceptions(a);
  const r = await deliver(d);
  if (!r.ok) return Response.json(r, { status: 502 });
  emit({ kind: "system", title: `Audit #${a.n} emailed`, detail: `→ ${r.to} · ${a.counts.new} new · ${a.counts.total} open`, tone: "good" });
  return Response.json({ ...r, subject: d.subject });
}
