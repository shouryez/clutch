import { extract } from "@/lib/contracts";

export async function POST(req: Request) {
  const { text } = (await req.json()) as { text?: string };
  if (!text || text.trim().length < 80) return Response.json({ error: "paste the contract text (at least a few clauses)" }, { status: 400 });
  return Response.json(await extract(text));
}
