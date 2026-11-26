import { addReply } from "@/lib/inbox";

/** A customer reply arrives (inbound email webhook; also used to try it live). */
export async function POST(req: Request) {
  const { accountId, body, subject } = (await req.json()) as { accountId?: string; body?: string; subject?: string };
  if (!accountId || !body?.trim()) return Response.json({ error: "accountId and body required" }, { status: 400 });
  try {
    return Response.json({ reply: await addReply(accountId, body.trim(), subject) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
