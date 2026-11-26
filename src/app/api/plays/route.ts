import { startPlay } from "@/lib/runner";
import type { PlayKey } from "@/lib/types";

const PLAYS: PlayKey[] = ["touchless", "competitor", "bug", "champion", "adoption", "billing", "expansion", "rightsize"];

export async function POST(req: Request) {
  const body = (await req.json()) as { accountId?: string; play?: PlayKey; autoSign?: boolean };
  if (!body.accountId || !body.play || !PLAYS.includes(body.play)) {
    return Response.json({ error: "accountId and a valid play are required" }, { status: 400 });
  }
  try {
    const run = startPlay(body.accountId, body.play, { autoSign: body.autoSign ?? body.play === "touchless" });
    return Response.json({ runId: run.id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
