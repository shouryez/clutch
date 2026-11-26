import { connection } from "next/server";
import { clusters, fileTopic, resolvedIssues, shipFix } from "@/lib/bugs";

export async function GET() {
  await connection();
  return Response.json({ clusters: clusters(), resolved: resolvedIssues() });
}

/** { topic } files the cluster as a P0; { topic, action: "ship" } is the "issue closed" webhook. */
export async function POST(req: Request) {
  const { topic, action } = (await req.json()) as { topic?: string; action?: "file" | "ship" };
  if (!topic) return Response.json({ error: "topic required" }, { status: 400 });
  try {
    if (action === "ship") return Response.json({ issue: await shipFix(topic) });
    const issue = await fileTopic(topic);
    if (!issue) return Response.json({ error: "unknown topic" }, { status: 404 });
    return Response.json({ issue });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
