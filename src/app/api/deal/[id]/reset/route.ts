import type { NextRequest } from "next/server";
import { dealView, getSession, resetSession } from "@/lib/negotiator";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/deal/[id]/reset">) {
  const { id } = await ctx.params;
  const { channel } = (await req.json().catch(() => ({}))) as { channel?: "chat" | "voice" };
  resetSession(id);
  getSession(id, channel === "voice" ? "voice" : "chat");
  return Response.json(dealView(id));
}
