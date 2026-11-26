import type { NextRequest } from "next/server";
import { decideSuggestion } from "@/lib/inbox";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/inbox/suggestions/[id]">) {
  const { id } = await ctx.params;
  const { approve } = (await req.json()) as { approve?: boolean };
  try {
    return Response.json(decideSuggestion(id, !!approve));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
