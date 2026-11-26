import { connection } from "next/server";

export async function GET() {
  await connection();
  return Response.json({ configured: !!(process.env.RESEND_API_KEY && process.env.DEMO_EMAIL_TO), to: process.env.DEMO_EMAIL_TO ?? null });
}
