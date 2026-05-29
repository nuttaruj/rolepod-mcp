import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ArtifactStore } from "../../src/artifact/ArtifactStore.js";
import { PlaywrightEngine } from "../../src/engine/PlaywrightEngine.js";
import { SessionRegistry } from "../../src/session/SessionRegistry.js";
import { verifyUiFlowTool } from "../../src/tools/composite/verify_ui_flow.js";
import type { ToolContext } from "../../src/tools/types.js";

/**
 * Field finding #4 — verify_ui_flow had no `scroll` step, so a page whose
 * content reveals only on a real scroll (IntersectionObserver) couldn't be
 * driven through a flow. We add `scroll` and a `settle` convenience step.
 *
 * The message text is `visibility:hidden` until an IntersectionObserver on a
 * below-fold box adds `.shown`. text_visible reads the a11y tree, which drops
 * visibility:hidden nodes (but keeps opacity:0 ones) — so the assertion is
 * false until a genuine scroll fires the observer. This is the exact reveal
 * trap from Phase-8, made deterministic.
 */
const FIXTURE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0}
  #top{height:100px}
  #spacer{height:1600px}
  #revealbox{height:400px}
  #revealbox .msg{visibility:hidden}
  #revealbox.shown .msg{visibility:visible}
</style></head>
<body>
  <div id="top">TOP-ALWAYS-VISIBLE</div>
  <div id="spacer"></div>
  <div id="revealbox"><p class="msg">SCROLL-REVEALED-TEXT</p></div>
  <script>
    var box = document.getElementById('revealbox');
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) box.classList.add('shown'); });
    }, { threshold: 0.01 }).observe(box);
  </script>
</body></html>`;

let tmpRoot: string;
let fixtureUrl: string;
let registry: SessionRegistry;
let store: ArtifactStore;
let ctx: ToolContext;

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "rolepod-uiproof-vscroll-"));
  const fixturePath = join(tmpRoot, "reveal.html");
  writeFileSync(fixturePath, FIXTURE_HTML, "utf8");
  fixtureUrl = pathToFileURL(fixturePath).href;

  const engine = new PlaywrightEngine();
  registry = new SessionRegistry({ idleTimeoutMs: 0 });
  registry.register("web", engine);
  store = new ArtifactStore({ rootDir: join(tmpRoot, "artifacts"), mode: "standalone" });
  ctx = { registry, store };
});

afterAll(async () => {
  await registry.shutdown();
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("verify_ui_flow scroll + settle steps (field finding #4)", () => {
  it("text stays hidden without a scroll step (negative control)", async () => {
    const handler = verifyUiFlowTool.build(ctx);
    const result = await handler({
      mode: "assert",
      open: { platform: "web", url: fixtureUrl, headless: true },
      steps: [],
      expect: [{ kind: "text_visible", text: "SCROLL-REVEALED-TEXT" }],
      close_on_finish: true,
      minimize: false,
    });
    const body = result.structuredContent as { passed: boolean };
    expect(body.passed).toBe(false); // reveal never fired — the false-OK trap
  });

  it("a settle step reveals below-fold IntersectionObserver content", async () => {
    const handler = verifyUiFlowTool.build(ctx);
    const result = await handler({
      mode: "assert",
      open: { platform: "web", url: fixtureUrl, headless: true },
      steps: [{ kind: "settle" }],
      expect: [{ kind: "text_visible", text: "SCROLL-REVEALED-TEXT" }],
      close_on_finish: true,
      minimize: false,
    });
    const body = result.structuredContent as { passed: boolean };
    expect(body.passed).toBe(true);
  });

  it("a scroll step + wait_for triggers the reveal", async () => {
    const handler = verifyUiFlowTool.build(ctx);
    const result = await handler({
      mode: "assert",
      open: { platform: "web", url: fixtureUrl, headless: true },
      steps: [
        { kind: "scroll", direction: "down", amount: 2000 },
        {
          kind: "wait_for",
          condition: { kind: "text_visible", text: "SCROLL-REVEALED-TEXT" },
        },
      ],
      expect: [{ kind: "text_visible", text: "SCROLL-REVEALED-TEXT" }],
      close_on_finish: true,
      minimize: false,
    });
    const body = result.structuredContent as { passed: boolean };
    expect(body.passed).toBe(true);
  });
});
