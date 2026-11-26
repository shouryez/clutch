import { connection } from "next/server";
import { compileBrief, currentBrief } from "@/lib/boardroom";
import { toCSV, toMarkdown, toPDF } from "@/lib/boardroom-export";

/**
 * One-click export: /api/boardroom/export?format=pdf|md|csv
 * &fresh=1 compiles from the current run first (the default for the Export button).
 */
export async function GET(req: Request) {
  await connection();
  const u = new URL(req.url);
  const format = (u.searchParams.get("format") ?? "pdf").toLowerCase();
  const b = u.searchParams.get("fresh") ? await compileBrief() : await currentBrief();
  const stamp = new Date(b.generatedAt + 5.5 * 3600_000).toISOString().slice(0, 16).replace(/[:T]/g, "-"); // IST
  const name = `clutch-boardroom-brief-${stamp}`;
  const inline = u.searchParams.has("inline");
  const disp = (ext: string) => `${inline ? "inline" : "attachment"}; filename="${name}.${ext}"`;
  if (format === "md" || format === "markdown") return new Response(toMarkdown(b), { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": disp("md"), "x-brief-id": b.id } });
  if (format === "csv") return new Response(toCSV(b), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": disp("csv"), "x-brief-id": b.id } });
  const pdf = await toPDF(b);
  return new Response(Buffer.from(pdf), { headers: { "content-type": "application/pdf", "content-disposition": disp("pdf"), "x-brief-id": b.id } });
}
