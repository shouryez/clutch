import { connection } from "next/server";
import { contractsView, SAMPLE_CONTRACT } from "@/lib/contracts";

export async function GET() {
  await connection();
  return Response.json({ contracts: contractsView(), sample: SAMPLE_CONTRACT });
}
