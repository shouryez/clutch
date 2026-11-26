import { copilot } from "@/lib/copilot";

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages?: { role: "user" | "assistant"; content: string }[] };
  if (!messages?.length) return Response.json({ error: "messages required" }, { status: 400 });
  return Response.json(await copilot(messages.map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }))));
}
