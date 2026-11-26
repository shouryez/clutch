import { connection } from "next/server";
import { stateView } from "@/lib/views";

export async function GET() {
  await connection();
  return Response.json(stateView());
}
