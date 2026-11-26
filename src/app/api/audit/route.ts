import { connection } from "next/server";
import { auditHistory, lastAudit, runAudit } from "@/lib/policy/engine";

export async function GET() {
  await connection();
  return Response.json({ audit: lastAudit(), history: auditHistory() });
}

/** Re-run the audit: every enabled rule × every account and open offer, diffed against the last run. */
export async function POST() {
  const audit = runAudit("manual");
  return Response.json({ audit, history: auditHistory() });
}
