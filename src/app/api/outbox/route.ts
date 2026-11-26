import { connection } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  await connection();
  return Response.json({ artifacts: store().artifacts.slice(0, 200) });
}
