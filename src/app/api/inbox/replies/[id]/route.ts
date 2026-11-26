import type { NextRequest } from "next/server";
import { handleReply } from "@/lib/inbox";

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/inbox/replies/[id]">) {
  const { id } = await ctx.params;
  try {
    return Response.json({ reply: await handleReply(id) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
