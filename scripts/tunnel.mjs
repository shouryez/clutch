// Starts a cloudflare quick tunnel to the app and writes its URL to .tunnel-url (read live by /api/public-url).
// HTTP/2 over TCP by default: QUIC (UDP) drops out on many home/mobile networks, which shows up as 530s and lag.
//   node scripts/tunnel.mjs [port]        CF_PROTOCOL=quic to override
import { spawn } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";

const port = process.argv[2] ?? "3210";
const bin = process.env.CLOUDFLARED ?? "C:/Program Files (x86)/cloudflared/cloudflared.exe";
const protocol = process.env.CF_PROTOCOL ?? "http2";
writeFileSync(".tunnel.log", "");
const cf = spawn(bin, ["tunnel", "--no-autoupdate", "--protocol", protocol, "--edge-ip-version", "4", "--url", `http://localhost:${port}`]);
let found = false;
const scan = (buf) => {
  const s = String(buf);
  appendFileSync(".tunnel.log", s);
  const m = !found && s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (m) {
    found = true;
    writeFileSync(".tunnel-url", m[0]);
    console.log(`TUNNEL ${m[0]} (${protocol})`);
  }
  for (const l of s.split("\n")) if (/Registered tunnel connection|ERR|error|retrying/i.test(l)) console.log(l.replace(/^\S+\s+/, "").slice(0, 160));
};
cf.stdout.on("data", scan);
cf.stderr.on("data", scan);
cf.on("exit", (c) => {
  console.log("cloudflared exited", c);
  process.exit(c ?? 0);
});
