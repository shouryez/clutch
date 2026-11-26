import { connection } from "next/server";
import { POLICY } from "@/lib/dealdesk";
import { applyPolicy, type Settings } from "@/lib/settings";
import { emit, store } from "@/lib/store";

export async function GET() {
  await connection();
  return Response.json({ settings: store().settings, policy: POLICY });
}

export async function POST(req: Request) {
  const patch = (await req.json()) as Partial<Settings>;
  const s = store().settings;
  if (patch.maxDiscount !== undefined) s.maxDiscount = Math.max(0, Math.min(0.3, Number(patch.maxDiscount)));
  if (patch.approvalAbove !== undefined) s.approvalAbove = Math.max(0, Math.min(s.maxDiscount, Number(patch.approvalAbove)));
  if (s.approvalAbove > s.maxDiscount) s.approvalAbove = s.maxDiscount;
  if (patch.autonomy) Object.assign(s.autonomy, patch.autonomy);
  if (patch.autoReplies !== undefined) s.autoReplies = !!patch.autoReplies;
  if (patch.autopilotLimit !== undefined) s.autopilotLimit = Math.max(1, Math.min(30, Math.round(Number(patch.autopilotLimit))));
  applyPolicy(s);
  emit({ kind: "system", title: "Settings updated", detail: `max discount ${Math.round(s.maxDiscount * 100)}% · approval above ${Math.round(s.approvalAbove * 100)}%`, tone: "neutral" });
  return Response.json({ settings: s, policy: POLICY });
}
