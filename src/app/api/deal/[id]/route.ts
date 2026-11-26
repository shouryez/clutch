import type { NextRequest } from "next/server";
import { dealView, respond } from "@/lib/negotiator";
import { getAccount } from "@/lib/store";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/deal/[id]">) {
  const { id } = await ctx.params;
  if (!getAccount(id)) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(dealView(id));
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/deal/[id]">) {
  const { id } = await ctx.params;
  if (!getAccount(id)) return Response.json({ error: "not found" }, { status: 404 });
  const { text, channel } = (await req.json()) as { text?: string; channel?: "chat" | "voice" };
  if (!text?.trim()) return Response.json({ error: "text required" }, { status: 400 });
  await respond(id, text.trim().slice(0, 600), channel === "voice" ? "voice" : "chat");
  return Response.json(dealView(id));
}
