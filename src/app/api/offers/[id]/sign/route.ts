import type { NextRequest } from "next/server";
import { signOffer } from "@/lib/runner";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/offers/[id]/sign">) {
  const { id } = await ctx.params;
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name?.trim()) return Response.json({ error: "name required" }, { status: 400 });
  const offer = signOffer(id, name.trim());
  if (!offer) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ offer });
}
