import { spawn } from "node:child_process";
import { resolve } from "node:path";

const bin = resolve(process.cwd(), "dist/bin/rolepod-uiproof.js");
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
  // atomic (10 — v0.1-v0.4)
  "rolepod_browser_open",
  "rolepod_browser_close",
  "rolepod_browser_snapshot",
  "rolepod_browser_click",
  "rolepod_browser_type",
  "rolepod_browser_key",
  "rolepod_browser_scroll",
  "rolepod_browser_wait_for",
  "rolepod_browser_screenshot",
  "rolepod_browser_navigate",
  // atomic (11 — v0.5)
  "rolepod_browser_hover",
  "rolepod_browser_drag",
  "rolepod_browser_fill_form",
  "rolepod_browser_upload_file",
  "rolepod_browser_handle_dialog",
  "rolepod_browser_console",
  "rolepod_browser_network",
  "rolepod_browser_set_env",
  "rolepod_browser_evaluate",
  "rolepod_browser_pages",
  "rolepod_browser_switch_page",
  // composite (5)
  "rolepod_verify_ui_flow",
  "rolepod_audit_a11y",
  "rolepod_visual_diff",
  "rolepod_scaffold_e2e",
  "rolepod_extract_ui_state",
];
const missing = expected.filter((n) => !names.includes(n));
if (missing.length) {
  console.error("MISSING:", missing);
  process.exit(1);
}

console.log("OK");
child.kill("SIGTERM");
setTimeout(() => process.exit(0), 200);
