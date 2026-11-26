import { importContract, type Extracted } from "@/lib/contracts";

export async function POST(req: Request) {
  const { extracted } = (await req.json()) as { extracted?: Extracted };
  if (!extracted?.customer) return Response.json({ error: "extracted contract required" }, { status: 400 });
  return Response.json(importContract(extracted));
}
