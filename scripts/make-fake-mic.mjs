// Builds a WAV the browser can use as a fake microphone: silence → customer line (Sarvam voice) → long silence.
// usage: node scripts/make-fake-mic.mjs "<hindi/hinglish text>" out.wav
import { readFileSync, writeFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const [text, out] = process.argv.slice(2);
const r = await fetch("https://api.sarvam.ai/text-to-speech", {
  method: "POST",
  headers: { "api-subscription-key": env.SARVAM_API_KEY, "content-type": "application/json" },
  body: JSON.stringify({ text, language_code: "hi-IN", model: "bulbul:v4-flash", speaker: "shubh_enhi_ads", speech_sample_rate: 16000, output_audio_codec: "wav" }),
});
const wav = Buffer.from((await r.json()).audios[0], "base64");
// find the PCM data chunk
let o = 12, data;
while (o < wav.length) {
  const id = wav.toString("ascii", o, o + 4), size = wav.readUInt32LE(o + 4);
  if (id === "data") { data = wav.subarray(o + 8, o + 8 + size); break; }
  o += 8 + size;
}
const rate = 16000, pre = Buffer.alloc(rate * 2 * 2), post = Buffer.alloc(rate * 2 * 14);
const pcm = Buffer.concat([pre, data, post]);
const h = Buffer.alloc(44);
h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
writeFileSync(out, Buffer.concat([h, pcm]));
console.log("wrote", out, (pcm.length / rate / 2).toFixed(1), "s");
