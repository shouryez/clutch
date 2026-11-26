// Conversation test for the Gemini agent (no audio). usage: npx tsx --env-file=.env.local scripts/test-agent.mts
import { approve, getSession, resetSession, respond } from "../src/lib/negotiator";
const id = "northwind-logistics";
resetSession(id);
console.log("CLUTCH:", getSession(id, "voice").messages[0].text, "\n");
const lines = [
  "Haan bolo. Yeh call kis baare mein hai?",
  "Hamara contract kab khatam ho raha hai?",
  "Exports baar baar fail ho rahe hain, isliye hum Freshdesk dekh rahe hain.",
  "Kya aapke paas SSO hai?",
  "Pachees percent discount do warna hum chale jayenge.",
  "Nahi, pandrah percent karo.",
  "Theek hai, bhej do.",
];
for (const l of lines) {
  const t = Date.now();
  let s = await respond(id, l, "voice", l);
  if (s.pendingApproval) {
    console.log(`  >> ${l}\nCLUTCH: ${s.messages[s.messages.length - 1].text}   (${Date.now() - t}ms)\n  [manager approves]`);
    s = await approve(id, true);
    console.log(`CLUTCH: ${s.messages[s.messages.length - 1].text}\n`);
    continue;
  }
  const last = s.messages.filter((m) => m.who !== "system").at(-1)!;
  console.log(`  >> ${l}\nCLUTCH [${s.lang}|${s.stage}] (${Date.now() - t}ms): ${last.text}\n`);
}
const s = getSession(id);
console.log("guard log:");
s.log.forEach((l) => console.log("  ", l.fn, l.args, l.result));
process.exit(0);
