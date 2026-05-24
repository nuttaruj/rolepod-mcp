import { spawn } from "node:child_process";
import { resolve } from "node:path";

const bin = resolve(process.cwd(), "dist/bin/rolepod-mcp.js");
const child = spawn("node", [bin], { stdio: ["pipe", "pipe", "inherit"] });

function send(obj) {
  child.stdin.write(JSON.stringify(obj) + "\n");
}

let buf = "";
const pending = new Map();
let nextId = 1;
function call(method, params = {}) {
  const id = nextId++;
  return new Promise((resolveResp) => {
    pending.set(id, resolveResp);
    send({ jsonrpc: "2.0", id, method, params });
  });
}

child.stdout.on("data", (chunk) => {
  buf += chunk.toString("utf8");
  let nl;
  while ((nl = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch (err) {
      console.error("parse fail:", err, line);
    }
  }
});

const initResp = await call("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "smoke", version: "0" },
});
console.log("[init]", JSON.stringify(initResp.result?.serverInfo));

send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });

const listResp = await call("tools/list", {});
const names = (listResp.result?.tools ?? []).map((t) => t.name);
console.log("[tools]", names.join(", "));

const expected = [
  "rolepod_browser_open",
  "rolepod_browser_close",
  "rolepod_browser_snapshot",
  "rolepod_browser_click",
  "rolepod_browser_type",
  "rolepod_verify_ui_flow",
];
const missing = expected.filter((n) => !names.includes(n));
if (missing.length) {
  console.error("MISSING:", missing);
  process.exit(1);
}

console.log("OK");
child.kill("SIGTERM");
setTimeout(() => process.exit(0), 200);
