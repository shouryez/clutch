import { autopilot } from "@/lib/copilot";
import { emit } from "@/lib/store";

export async function POST() {
  const r = autopilot();
  emit({ kind: "system", title: `Autopilot engaged — ${r.started.length} plays starting`, detail: r.started.map((s) => s.account).join(" · "), tone: "action" });
  return Response.json(r);
}
