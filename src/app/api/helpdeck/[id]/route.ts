import type { NextRequest } from "next/server";
import { applySave, cancelContext, confirmCancel, offersFor, undoCancel, type Reason } from "@/lib/retention";

const REASONS: Reason[] = ["bugs", "price", "usage", "switching", "feature", "other"];

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/helpdeck/[id]">) {
  const { id } = await ctx.params;
  const c = cancelContext(id);
  if (!c) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(c);
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/helpdeck/[id]">) {
  const { id } = await ctx.params;
  if (!cancelContext(id)) return Response.json({ error: "not found" }, { status: 404 });
  const b = (await req.json()) as { action: "offers" | "save" | "cancel" | "reset"; reason?: Reason; offerKey?: string; note?: string };
  const reason = b.reason && REASONS.includes(b.reason) ? b.reason : "other";
  switch (b.action) {
    case "offers":
      return Response.json({ offers: offersFor(id, reason) });
    case "save":
      try {
        return Response.json({ saved: await applySave(id, reason, b.offerKey ?? "", b.note?.slice(0, 400)) });
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 400 });
      }
    case "cancel":
      confirmCancel(id, reason, b.note?.slice(0, 400));
      return Response.json({ ok: true });
    case "reset":
      undoCancel(id);
      return Response.json({ ok: true });
    default:
      return Response.json({ error: "unknown action" }, { status: 400 });
  }
}
