import { connection } from "next/server";
import { inboxView } from "@/lib/inbox";

export async function GET() {
  await connection();
  return Response.json(inboxView());
}
