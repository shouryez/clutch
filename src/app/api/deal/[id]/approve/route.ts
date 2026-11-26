import type { NextRequest } from "next/server";
import { approve, dealView } from "@/lib/negotiator";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/deal/[id]/approve">) {
  const { id } = await ctx.params;
  const { approve: ok } = (await req.json().catch(() => ({}))) as { approve?: boolean };
  await approve(id, ok !== false);
  return Response.json(dealView(id));
}
