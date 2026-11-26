import type { NextRequest } from "next/server";
import { resolveWait } from "@/lib/store";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/runs/[id]/advance">) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { note?: string };
  const ok = resolveWait(`advance:${id}`, body.note ?? "done");
  return Response.json({ ok });
}
