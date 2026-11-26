import type { NextRequest } from "next/server";
import { accountView } from "@/lib/views";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/accounts/[id]">) {
  const { id } = await ctx.params;
  const v = accountView(id);
  if (!v) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(v);
}
