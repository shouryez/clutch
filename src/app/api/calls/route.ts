import { connection } from "next/server";
import { callsView } from "@/lib/copilot";

export async function GET() {
  await connection();
  return Response.json({ calls: callsView() });
}
