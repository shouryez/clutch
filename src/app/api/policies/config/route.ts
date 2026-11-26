import { connection } from "next/server";
import { exportConfig, POLICY_FILE_LABEL, replaceConfig, validateText } from "@/lib/policy/engine";

/** The raw config file. ?format=json converts; ?download=1 sends it as a file. */
export async function GET(req: Request) {
  await connection();
  const u = new URL(req.url);
  const format = u.searchParams.get("format") === "json" ? "json" : "yaml";
  const body = exportConfig(format);
  const headers: Record<string, string> = { "content-type": format === "json" ? "application/json; charset=utf-8" : "text/yaml; charset=utf-8" };
  if (u.searchParams.get("download")) headers["content-disposition"] = `attachment; filename="policies.${format === "json" ? "json" : "yaml"}"`;
  return new Response(body, { headers });
}

/**
 * Replace the whole rule set (YAML or JSON).
 * { text, dryRun?, source? }  or a raw YAML/JSON body (curl --data-binary @policies.yaml).
 */
export async function POST(req: Request) {
  const raw = await req.text();
  let text = raw;
  let dryRun = new URL(req.url).searchParams.has("dryRun");
  let source: "ui" | "upload" | "api" = "api";
  try {
    const j = JSON.parse(raw) as { text?: unknown; dryRun?: boolean; source?: string };
    if (typeof j.text === "string") {
      text = j.text;
      dryRun = dryRun || !!j.dryRun;
      source = j.source === "upload" ? "upload" : j.source === "ui" ? "ui" : "api";
    }
  } catch {
    /* raw YAML body */
  }
  if (dryRun) return Response.json(validateText(text));
  const res = replaceConfig(text, source);
  return Response.json({ ...res, file: POLICY_FILE_LABEL }, { status: res.ok ? 200 : 422 });
}
