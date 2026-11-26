import { connection } from "next/server";
import { FIELDS } from "@/lib/policy/catalog";
import { policyView, removeRule, toggleRule, upsertRule } from "@/lib/policy/engine";
import { TEMPLATES } from "@/lib/policy/templates";
import { store } from "@/lib/store";

export async function GET() {
  await connection();
  const s = store();
  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  // enum options that come from the live data (industries, cities, CSMs)
  const dynamic: Record<string, string[]> = { industry: uniq(s.accounts.map((a) => a.industry).filter((x) => x !== "—")), city: uniq(s.accounts.map((a) => a.city)), csm: uniq(s.accounts.map((a) => a.csm)) };
  return Response.json({ ...policyView(), fields: FIELDS.map((f) => (dynamic[f.key] ? { ...f, options: dynamic[f.key] } : f)), templates: TEMPLATES });
}

/** { action: "upsert", rule, originalId? } | { action: "delete", id } | { action: "toggle", id, enabled } */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { action?: string; rule?: unknown; originalId?: string; id?: string; enabled?: boolean };
  const res =
    b.action === "delete" && b.id ? removeRule(b.id) : b.action === "toggle" && b.id ? toggleRule(b.id, !!b.enabled) : b.rule ? upsertRule(b.rule, b.originalId) : { ok: false as const, issues: [{ path: "", message: "expected { action, rule | id }" }] };
  return Response.json(res, { status: res.ok ? 200 : 422 });
}
