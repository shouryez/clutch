import type { NextRequest } from "next/server";
import { summarize } from "@/lib/callsummary";

/** Write the CRM summary for a call or chat (called when the phone hangs up). */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/deal/[id]/summary">) {
  const { id } = await ctx.params;
  try {
    return Response.json({ summary: await summarize(id) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
