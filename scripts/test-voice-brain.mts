// End-to-end voice-brain test without a browser or mic:
// customer line → Sarvam TTS (customer voice) → Sarvam STT → Gemini understand → deal desk → Gemini compose → Sarvam TTS.
// usage: npx tsx --env-file=.env.local scripts/test-voice-brain.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { approve, getSession, resetSession } from "../src/lib/negotiator";
import { respond } from "../src/lib/negotiator";
import { speakAll, transcribe } from "../src/lib/sarvam";

const out = process.env.OUT_DIR ?? "scripts/.voice-test";
mkdirSync(out, { recursive: true });
const id = "northwind-logistics";

async function customerSays(line: string) {
  const r = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "api-subscription-key": process.env.SARVAM_API_KEY!, "content-type": "application/json" },
    body: JSON.stringify({ text: line, language_code: "hi-IN", model: "bulbul:v4-flash", speaker: "shubh_enhi_ads", speech_sample_rate: 16000, output_audio_codec: "mp3" }),
  });
  const j = (await r.json()) as { audios: string[] };
  return new Blob([Buffer.from(j.audios[0], "base64")], { type: "audio/mpeg" });
}

resetSession(id);
const ses = getSession(id, "voice");
console.log("CLUTCH:", ses.messages[0].text, "\n");

const lines = [
  "हाँ बोलो। सच कहूँ तो exports बहुत fail हो रहे हैं, हम Freshdesk देख रहे हैं।",
  "ठीक है, लेकिन पच्चीस percent discount दो, वरना मुश्किल है।",
  "नहीं, बारह percent करो, तो हम sign कर देंगे।",
];
let n = 0;
for (const line of lines) {
  const audio = await customerSays(line);
  let t = Date.now();
  const tr = await transcribe(audio, "c.mp3");
  const stt = Date.now() - t;
  t = Date.now();
  const s = await respond(id, tr.exact, "voice", tr.display);
  const brain = Date.now() - t;
  const reply = s.messages[s.messages.length - 1];
  t = Date.now();
  const parts = await speakAll(reply.speech ?? reply.text, s.lang);
  const tts = Date.now() - t;
  n++;
  parts.forEach((p, i) => writeFileSync(`${out}/reply-${n}-${i}.mp3`, Buffer.from(p, "base64")));
  console.log(`HEARD (${tr.language}): ${tr.display}`);
  console.log(`  exact: ${tr.exact}`);
  console.log(`CLUTCH [${s.lang} · ${s.stage} · risk ${s.risk}]: ${reply.text}`);
  if (reply.speech) console.log(`  speech: ${reply.speech}`);
  console.log(`  timing stt ${stt}ms · brain ${brain}ms · tts ${tts}ms\n`);
}
if (getSession(id).pendingApproval) {
  const s = await approve(id, true);
  console.log("AFTER APPROVAL:", s.messages[s.messages.length - 1].text, "\n");
}
const s = await respond(id, "ठीक है, भेज दो।", "voice", "Theek hai, bhej do.");
console.log("FINAL:", s.stage, "|", s.messages.slice(-2).map((m) => `${m.who}: ${m.text}`).join(" || "));
console.log("\nGUARD LOG:");
for (const l of s.log) console.log(" ", l.fn, l.args, l.result);
process.exit(0);
