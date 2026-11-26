import { connection } from "next/server";
import { compileBrief, currentBrief } from "@/lib/boardroom";

/** The latest compiled brief (compiles one if none exists yet). */
export async function GET() {
  await connection();
  return Response.json(await currentBrief());
}

/** Compile a fresh brief from the current run. */
export async function POST() {
  return Response.json(await compileBrief());
}
