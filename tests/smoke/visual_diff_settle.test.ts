import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ArtifactStore } from "../../src/artifact/ArtifactStore.js";
import { PlaywrightEngine } from "../../src/engine/PlaywrightEngine.js";
import { SessionRegistry } from "../../src/session/SessionRegistry.js";
import { visualDiffTool } from "../../src/tools/composite/visual_diff.js";
import type { ToolContext } from "../../src/tools/types.js";

/**
 * Regression guard for the settle/freeze capture path.
 *
 * The fixture puts a red block 1500px down (below the default 720px fold)
 * that starts `opacity:0` and is only revealed when an IntersectionObserver
 * sees it scroll into view — the exact pattern that made visual_diff baseline
 * pages while they were still invisible. An immediate fullPage capture never
 * fires the observer (CDP captureBeyondViewport does not scroll), so the
 * block stays blank; settle() scrolls it into view first.
 */
const FIXTURE_HTML = `<!doctype html>
<html>
<head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#ffffff}
  #box{width:200px;height:100px;background:#00ff00}
  #spacer{height:1400px;background:#ffffff}
  #reveal{height:600px;background:#ff0000;opacity:0;transition:opacity .3s ease}
  #reveal.shown{opacity:1}
</style></head>
<body>
  <div id="box"></div>
  <div id="spacer"></div>
  <div id="reveal"></div>
  <script>
    var el = document.getElementById('reveal');
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) el.classList.add('shown'); });
    }, { threshold: 0.01 }).observe(el);
  </script>
</body>
</html>`;

// visual_diff always writes baselines under <cwd>/.rolepod-uiproof/baselines
// (gitignored). Clean ours before/after so a leftover from a prior run can't
// change seed-vs-diff behaviour.
const BASELINE_DIR = join(process.cwd(), ".rolepod-uiproof", "baselines");
const BASELINE_IDS = [
  "reveal_fixture",
  "reveal_fixture_nosettle",
  "box_region",
  "dim_mismatch",
];
function cleanBaselines(): void {
  for (const id of BASELINE_IDS) {
    rmSync(join(BASELINE_DIR, `${id}.png`), { force: true });
  }
}

let tmpRoot: string;
let fixtureUrl: string;
let registry: SessionRegistry;
let engine: PlaywrightEngine;
let store: ArtifactStore;
let ctx: ToolContext;

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "rolepod-uiproof-settle-"));
  const fixturePath = join(tmpRoot, "reveal.html");
  writeFileSync(fixturePath, FIXTURE_HTML, "utf8");
  fixtureUrl = pathToFileURL(fixturePath).href;

  engine = new PlaywrightEngine();
  registry = new SessionRegistry({ idleTimeoutMs: 0 });
  registry.register("web", engine);
  store = new ArtifactStore({ rootDir: join(tmpRoot, "artifacts"), mode: "standalone" });
  ctx = { registry, store };
  cleanBaselines();
});

afterAll(async () => {
  await registry.shutdown();
  rmSync(tmpRoot, { recursive: true, force: true });
  cleanBaselines();
});

describe("settle + freeze capture", () => {
  let leftover: { id: string; platform: "web" } | null = null;

  afterEach(async () => {
    if (leftover) {
      await registry.close(leftover).catch(() => undefined);
      leftover = null;
    }
  });

  it("settle reveals below-fold IntersectionObserver content the immediate capture misses", async () => {
    const session = await registry.open({ platform: "web", url: fixtureUrl, headless: true });
    leftover = { id: session.id, platform: "web" };

    // BUG: capture right after load — the reveal never fired, so it is blank.
    const before = PNG.sync.read(
      await engine.screenshot({ id: session.id, platform: "web" }, true),
    );
    expect(isRed(avgColor(before, 600, 1700, 80, 200))).toBe(false);

    // FIX: settle scrolls the block into view (firing the observer), then a
    // frozen capture records it.
    const info = await engine.settle({ id: session.id, platform: "web" });
    expect(info.scrolled_steps).toBeGreaterThan(0);
    expect(info.capped).toBe(false);

    const after = PNG.sync.read(
      await engine.screenshot({ id: session.id, platform: "web" }, true, {
        freezeMotion: true,
      }),
    );
    expect(isRed(avgColor(after, 600, 1700, 80, 200))).toBe(true);
  });

  it("visual_diff (settle on) seeds a baseline that contains the revealed content", async () => {
    const handler = visualDiffTool.build(ctx);
    const result = await handler({
      open: { platform: "web", url: fixtureUrl, headless: true },
      baseline_id: "reveal_fixture",
      threshold_pct: 0.1,
      pixel_threshold: 0.1,
      close_on_finish: true,
      settle: true,
    });

    expect(result.isError).not.toBe(true);
    const body = result.structuredContent as Record<string, unknown>;
    expect(body.passed).toBe(true);
    expect(String(body.baseline_path)).toMatch(/reveal_fixture\.png$/);

    // The seeded baseline must show the red block — not a blank page. This is
    // the false-OK that the old one-shot capture produced.
    const baseline = PNG.sync.read(readFileSync(String(body.baseline_path)));
    expect(isRed(avgColor(baseline, 600, 1700, 80, 200))).toBe(true);
  });

  it("settle=false keeps the legacy immediate capture (baseline stays blank)", async () => {
    const handler = visualDiffTool.build(ctx);
    const result = await handler({
      open: { platform: "web", url: fixtureUrl, headless: true },
      baseline_id: "reveal_fixture_nosettle",
      threshold_pct: 0.1,
      pixel_threshold: 0.1,
      close_on_finish: true,
      settle: false,
    });

    const body = result.structuredContent as Record<string, unknown>;
    const baseline = PNG.sync.read(readFileSync(String(body.baseline_path)));
    expect(isRed(avgColor(baseline, 600, 1700, 80, 200))).toBe(false);
  });

  it("visual_diff with a selector captures only that element (region-scoped)", async () => {
    const handler = visualDiffTool.build(ctx);
    const result = await handler({
      open: { platform: "web", url: fixtureUrl, headless: true },
      baseline_id: "box_region",
      threshold_pct: 0.1,
      pixel_threshold: 0.1,
      close_on_finish: true,
      settle: false,
      selector: "#box",
    });

    expect(result.isError).not.toBe(true);
    const body = result.structuredContent as Record<string, unknown>;
    expect(body.passed).toBe(true);

    // Baseline is the element's own 200×100 box — not a 1280-wide full page.
    const png = PNG.sync.read(readFileSync(String(body.baseline_path)));
    expect(png.width).toBe(200);
    expect(png.height).toBe(100);
    expect(isGreen(avgColor(png, 60, 30, 80, 40))).toBe(true);
  });

  it("reports a graceful dimension mismatch instead of throwing", async () => {
    const handler = visualDiffTool.build(ctx);

    // Seed at 800px wide.
    const seed = await handler({
      open: { platform: "web", url: fixtureUrl, headless: true },
      baseline_id: "dim_mismatch",
      viewport: { width: 800, height: 600 },
      threshold_pct: 0.1,
      pixel_threshold: 0.1,
      close_on_finish: true,
      settle: false,
    });
    expect((seed.structuredContent as Record<string, unknown>).passed).toBe(true);

    // Re-capture at 1000px wide → full-page width differs → mismatch.
    const second = await handler({
      open: { platform: "web", url: fixtureUrl, headless: true },
      baseline_id: "dim_mismatch",
      viewport: { width: 1000, height: 600 },
      threshold_pct: 0.1,
      pixel_threshold: 0.1,
      close_on_finish: true,
      settle: false,
    });
    expect(second.isError).not.toBe(true); // graceful, not a thrown engine_error
    const body = second.structuredContent as Record<string, unknown>;
    expect(body.dimension_mismatch).toBe(true);
    expect(body.passed).toBe(false);
    expect((body.dimensions as { width_delta: number }).width_delta).toBe(200);
    expect(String(body.diff_image_path)).toMatch(/diff\.png$/);
  });
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Average RGB over a w×h box at (x0,y0). Robust to antialiasing. */
function avgColor(
  png: { width: number; height: number; data: Buffer },
  x0: number,
  y0: number,
  w: number,
  h: number,
): { r: number; g: number; b: number } {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = y0; y < y0 + h && y < png.height; y++) {
    for (let x = x0; x < x0 + w && x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      r += png.data[i] ?? 0;
      g += png.data[i + 1] ?? 0;
      b += png.data[i + 2] ?? 0;
      n++;
    }
  }
  return n ? { r: r / n, g: g / n, b: b / n } : { r: 0, g: 0, b: 0 };
}

function isRed({ r, g, b }: { r: number; g: number; b: number }): boolean {
  return r > 200 && g < 80 && b < 80;
}

function isGreen({ r, g, b }: { r: number; g: number; b: number }): boolean {
  return g > 200 && r < 80 && b < 80;
}
