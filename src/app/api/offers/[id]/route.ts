import type { NextRequest } from "next/server";
import { getAccount, store } from "@/lib/store";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/offers/[id]">) {
  const { id } = await ctx.params;
  const offer = store().offers.find((o) => o.id === id);
  if (!offer) return Response.json({ error: "not found" }, { status: 404 });
  const a = getAccount(offer.accountId)!;
  return Response.json({
    offer,
    account: { id: a.id, name: a.name, plan: a.plan, city: a.city },
    contact: a.contacts.find((c) => c.id === offer.sentTo) ?? a.contacts.find((c) => c.isChampion && !c.bounced) ?? a.contacts.find((c) => !c.bounced),
  });
}
