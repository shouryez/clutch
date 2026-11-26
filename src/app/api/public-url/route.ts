import { readFile } from "node:fs/promises";
import { connection } from "next/server";

/** The tunnel URL phones should use. scripts/tunnel.mjs writes .tunnel-url whenever cloudflared starts. */
export async function GET() {
  await connection();
  let url = "";
  try {
    url = (await readFile(".tunnel-url", "utf8")).trim();
  } catch {}
  return Response.json({ url: url || process.env.PUBLIC_URL || "" });
}
