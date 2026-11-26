/**
 * Workspace settings: the guardrails the deal desk enforces and how much each
 * play may do on its own. Autopilot reads these; nothing bypasses them.
 */
import { POLICY } from "./dealdesk";
import type { PlayKey } from "./types";

export type Autonomy = "off" | "ask" | "auto";

export type Settings = {
  maxDiscount: number;
  approvalAbove: number;
  autonomy: Record<Exclude<PlayKey, "negotiated">, Autonomy>;
  autoReplies: boolean; // let Clutch handle inbound customer replies as they arrive
  autopilotLimit: number;
};

export function defaultSettings(): Settings {
  return {
    maxDiscount: 0.15,
    approvalAbove: 0.1,
    autonomy: { touchless: "auto", competitor: "auto", bug: "auto", champion: "auto", adoption: "auto", billing: "auto", expansion: "ask", rightsize: "ask" },
    autoReplies: false,
    autopilotLimit: 10,
  };
}

/** Push guardrails into the deal desk policy (the single place offers are checked). */
export function applyPolicy(s: Settings) {
  POLICY.maxDiscount = s.maxDiscount;
  POLICY.approvalAbove = s.approvalAbove;
}
