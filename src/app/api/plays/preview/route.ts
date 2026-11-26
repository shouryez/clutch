import { connection, type NextRequest } from "next/server";
import { planFor } from "@/lib/explain";
import type { PlayKey } from "@/lib/types";

/** What a play will do for one account, step by step, before it runs. */
export async function GET(req: NextRequest) {
  await connection();
  const accountId = req.nextUrl.searchParams.get("accountId") ?? "";
  const play = req.nextUrl.searchParams.get("play") as PlayKey;
  const plan = planFor(accountId, play);
  if (!plan) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(plan);
}
