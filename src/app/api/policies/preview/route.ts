import { previewRule } from "@/lib/policy/engine";

/** Dry-run a draft rule against the live book. Nothing is saved. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { rule?: unknown; probe?: { discountPct: number; termMonths: number } };
  return Response.json(previewRule(b.rule ?? {}, b.probe));
}
