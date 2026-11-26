import { compileBrief } from "@/lib/boardroom";
import { toPDF } from "@/lib/boardroom-export";
import { deliver, draftBrief } from "@/lib/mailer";
import { emit } from "@/lib/store";

/** Compile the brief from the current run and email it with the PDF attached. */
export async function POST() {
  const b = await compileBrief();
  const pdf = Buffer.from(await toPDF(b)).toString("base64");
  const d = draftBrief(b);
  const r = await deliver(d, [{ filename: `clutch-boardroom-brief-${b.id}.pdf`, content: pdf }]);
  if (!r.ok) return Response.json(r, { status: 502 });
  emit({ kind: "system", title: `Boardroom brief emailed`, detail: `→ ${r.to} · PDF attached · ${b.citations.length} citations`, tone: "good" });
  return Response.json({ ...r, subject: d.subject, briefId: b.id });
}
