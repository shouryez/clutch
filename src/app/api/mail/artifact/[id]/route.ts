import type { NextRequest } from "next/server";
import { deliver, draftForArtifact } from "@/lib/mailer";
import { emit, store } from "@/lib/store";

/** Preview the drafted email for a step's artifact. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/mail/artifact/[id]">) {
  const { id } = await ctx.params;
  const art = store().artifacts.find((a) => a.id === id);
  if (!art) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ draft: draftForArtifact(art), sent: art.sent ?? null, to: process.env.DEMO_EMAIL_TO ?? null });
}

/** Send it for real. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/mail/artifact/[id]">) {
  const { id } = await ctx.params;
  const art = store().artifacts.find((a) => a.id === id);
  if (!art) return Response.json({ error: "not found" }, { status: 404 });
  const d = draftForArtifact(art);
  const r = await deliver(d);
  if (!r.ok) return Response.json(r, { status: 502 });
  art.sent = { at: Date.now(), id: r.id!, to: r.to!, mode: "live", note: r.note };
  emit({ kind: "system", accountId: art.accountId, accountName: art.accountName, title: `Email sent: ${d.subject}`, detail: `→ ${r.to} · ${d.scenario}`, tone: "good" });
  return Response.json({ ...r, subject: d.subject });
}
