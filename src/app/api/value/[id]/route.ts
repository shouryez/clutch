import { connection, type NextRequest } from "next/server";
import { getAccount, getHealth } from "@/lib/store";
import { valueOf } from "@/lib/value";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/value/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const a = getAccount(id);
  if (!a) return Response.json({ error: "not found" }, { status: 404 });
  const champ = a.contacts.find((c) => c.isChampion && !c.bounced) ?? a.contacts.find((c) => !c.bounced);
  return Response.json({
    account: { id: a.id, name: a.name, plan: a.plan, seats: a.seats, renewal: a.contract.end, since: a.contract.start, champion: champ?.name ?? null },
    daysToRenewal: getHealth(id).daysToRenewal,
    value: valueOf(a),
  });
}
