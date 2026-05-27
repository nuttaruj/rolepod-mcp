import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ArtifactStore } from "../../src/artifact/ArtifactStore.js";
import { SessionRegistry } from "../../src/session/SessionRegistry.js";
import { PlaywrightEngine } from "../../src/engine/PlaywrightEngine.js";
import { scaffoldE2eTool } from "../../src/tools/composite/scaffold_e2e.js";
import type { ToolContext } from "../../src/tools/types.js";

/**
 * Unit tests for the v0.5 codegen extensions in `scaffold_e2e`.
 *
 * No browser is launched — `scaffold_e2e` only ever launches one when
 * the user passes `recorded_bundle`, and these tests pass a synthetic
 * bundle written to disk.
 */

type Step = Record<string, unknown>;
type Expect = Record<string, unknown>;

const tmp = mkdtempSync(join(tmpdir(), "rolepod-uiproof-v05-codegen-"));

function makeContext(): ToolContext {
  const registry = new SessionRegistry({});
  registry.register("web", new PlaywrightEngine());
  return {
    registry,
    store: new ArtifactStore({ rootDir: tmp }),
  };
}

async function writeBundle(steps: Step[], expectArr: Expect[] = []): Promise<string> {
  const { writeFile } = await import("node:fs/promises");
  const path = resolve(tmp, `bundle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  await writeFile(
    path,
    JSON.stringify(
      {
        version: 1,
        run_id: "test",
        recorded_at: new Date().toISOString(),
        open: { platform: "web", url: "https://example.com" },
        steps,
        expect: expectArr,
      },
      null,
      2,
    ),
    "utf8",
  );
  return path;
}

async function generate(
  framework: "playwright-test" | "vitest+playwright" | "pytest+selenium",
  steps: Step[],
  expectArr: Expect[] = [],
): Promise<string> {
  const ctx = makeContext();
  const bundlePath = await writeBundle(steps, expectArr);
  const handler = scaffoldE2eTool.build(ctx);
  const out = await handler({
    framework,
    scenario_nl: "v0.5 codegen test",
    url: "https://example.com",
    recorded_bundle: bundlePath,
  });
  const content = JSON.parse(out.content[0]!.text as string) as {
    test_file_path: string;
  };
  return readFileSync(content.test_file_path, "utf8");
}

describe("scaffold_e2e — v0.5 step codegen (playwright-test)", () => {
  it("emits hover via locator.hover()", async () => {
    const code = await generate("playwright-test", [
      { kind: "hover", query: "More options" },
    ]);
    expect(code).toContain("hover()");
    expect(code).toContain("More options");
  });

  it("emits drag via locator.dragTo()", async () => {
    const code = await generate("playwright-test", [
      { kind: "drag", from_query: "Card A", to_query: "Column 2" },
    ]);
    expect(code).toContain("dragTo");
    expect(code).toContain("Card A");
    expect(code).toContain("Column 2");
  });

  it("emits per-field fill_form lines dispatched by kind", async () => {
    const code = await generate("playwright-test", [
      {
        kind: "fill_form",
        fields: [
          { query: "Name", value: "Alice" },
          { query: "Subscribe", value: true, kind: "checkbox" },
          { query: "Country", value: "TH", kind: "select" },
        ],
      },
    ]);
    expect(code).toContain(".fill(");
    expect(code).toContain(".setChecked(true)");
    expect(code).toContain('.selectOption("TH")');
  });

  it("emits upload via setInputFiles", async () => {
    const code = await generate("playwright-test", [
      { kind: "upload", query: "Avatar", file_path: "/abs/path.png" },
    ]);
    expect(code).toContain("setInputFiles");
    expect(code).toContain("/abs/path.png");
  });

  it("emits dialog as page.once('dialog')", async () => {
    const code = await generate("playwright-test", [
      { kind: "dialog", action: "accept" },
    ]);
    expect(code).toContain('page.once("dialog"');
    expect(code).toContain("dialog.accept()");
  });

  it("emits set_env as setViewportSize + emulateMedia", async () => {
    const code = await generate("playwright-test", [
      {
        kind: "set_env",
        viewport: { width: 375, height: 812 },
        color_scheme: "dark",
        offline: true,
      },
    ]);
    expect(code).toContain("setViewportSize");
    expect(code).toContain("emulateMedia");
    expect(code).toContain("setOffline(true)");
  });

  it("emits switch_page using context.pages()", async () => {
    const code = await generate("playwright-test", [
      { kind: "switch_page", index: 1 },
    ]);
    expect(code).toContain("context().pages()");
    expect(code).toContain("[1]");
  });

  it("emits evaluate via page.evaluate", async () => {
    const code = await generate("playwright-test", [
      { kind: "evaluate", script: "return document.title;" },
    ]);
    expect(code).toContain("page.evaluate(");
    expect(code).toContain("document.title");
  });
});

describe("scaffold_e2e — v0.5 expect codegen (playwright-test)", () => {
  it("emits request_made via waitForRequest", async () => {
    const code = await generate(
      "playwright-test",
      [],
      [{ kind: "request_made", url_pattern: "/api/checkout", method: "POST" }],
    );
    expect(code).toContain("waitForRequest");
    expect(code).toContain("/api/checkout");
  });

  it("emits response_status via waitForResponse with status check", async () => {
    const code = await generate(
      "playwright-test",
      [],
      [{ kind: "response_status", url_pattern: "/api/me", status: 200 }],
    );
    expect(code).toContain("waitForResponse");
    expect(code).toContain("status() === 200");
  });

  it("emits TODO scaffolding for no_console_errors", async () => {
    const code = await generate(
      "playwright-test",
      [],
      [{ kind: "no_console_errors" }],
    );
    expect(code).toContain("no_console_errors");
    expect(code).toContain("page.on('console')");
  });

  it("emits TODO scaffolding for no_failed_requests", async () => {
    const code = await generate(
      "playwright-test",
      [],
      [{ kind: "no_failed_requests" }],
    );
    expect(code).toContain("no_failed_requests");
    expect(code).toContain("requestfailed");
  });
});

describe("scaffold_e2e — v0.5 step codegen (pytest+selenium)", () => {
  it("emits hover via ActionChains.move_to_element", async () => {
    const code = await generate("pytest+selenium", [
      { kind: "hover", query: "More" },
    ]);
    expect(code).toContain("ActionChains");
    expect(code).toContain("move_to_element");
  });

  it("emits drag via ActionChains.drag_and_drop", async () => {
    const code = await generate("pytest+selenium", [
      { kind: "drag", from_query: "A", to_query: "B" },
    ]);
    expect(code).toContain("drag_and_drop");
  });

  it("emits dialog via switch_to.alert", async () => {
    const code = await generate("pytest+selenium", [
      { kind: "dialog", action: "dismiss" },
    ]);
    expect(code).toContain("switch_to.alert");
    expect(code).toContain(".dismiss()");
  });

  it("emits switch_page via switch_to.window", async () => {
    const code = await generate("pytest+selenium", [
      { kind: "switch_page", index: 0 },
    ]);
    expect(code).toContain("switch_to.window");
    expect(code).toContain("window_handles[0]");
  });

  it("emits evaluate via execute_script", async () => {
    const code = await generate("pytest+selenium", [
      { kind: "evaluate", script: "return 1;" },
    ]);
    expect(code).toContain("execute_script");
  });

  it("emits no_console_errors via driver.get_log('browser')", async () => {
    const code = await generate(
      "pytest+selenium",
      [],
      [{ kind: "no_console_errors" }],
    );
    expect(code).toContain('get_log("browser")');
    expect(code).toContain("SEVERE");
  });
});

afterAll();

// Helper — vitest's tmp dir is per-process; clean up our scratch space.
function afterAll(): void {
  const teardown = () => {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  };
  // Use process exit hook so it runs after all tests in this file.
  process.once("beforeExit", teardown);
}
