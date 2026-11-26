import { connection } from "next/server";
import { llmEnabled } from "@/lib/llm";
import { sarvamEnabled } from "@/lib/sarvam";

export async function GET() {
  await connection();
  return Response.json({ sarvam: sarvamEnabled(), llm: llmEnabled() });
}
