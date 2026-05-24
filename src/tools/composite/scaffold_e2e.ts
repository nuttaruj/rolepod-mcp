import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  scaffoldE2eShape,
  ToolNames,
  type ScaffoldE2eInput,
} from "../../schema/tools.js";
import { RolepodMcpError } from "../../util/errors.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

type Step = { kind: string; [k: string]: unknown };
type Expect = { kind: string; [k: string]: unknown };
type ReplayShape = {
  version: number;
  open?: { url?: string };
  steps?: Step[];
  expect?: Expect[];
};

export const scaffoldE2eTool: ToolModule<typeof scaffoldE2eShape> = {
  name: ToolNames.scaffoldE2e,
  description:
    "Generate a runnable e2e test file (playwright-test, vitest+playwright, or pytest+selenium) from a scenario description and optional replay bundle from a prior verify_ui_flow run.",
  inputShape: scaffoldE2eShape,
  build(ctx) {
    return safeHandler(async (args: ScaffoldE2eInput) => {
      const { runId, runDir } = await ctx.store.startRun("scaffold");
      const slug = slugify(args.scenario_nl);
      const bundle = args.recorded_bundle
        ? await loadReplay(args.recorded_bundle)
        : null;
      const ctxObj = { args, slug, bundle };

      let body: string;
      let language: "typescript" | "python";
      let filename: string;
      let dependencies: string[];
      let setupNotes: string;

      switch (args.framework) {
        case "playwright-test":
          body = renderPlaywrightTest(ctxObj);
          language = "typescript";
          filename = args.filename ?? `${slug}.spec.ts`;
          dependencies = ["@playwright/test"];
          setupNotes =
            "Install: `npm i -D @playwright/test && npx playwright install`. Run: `npx playwright test`.";
          break;
        case "vitest+playwright":
          body = renderVitestPlaywright(ctxObj);
          language = "typescript";
          filename = args.filename ?? `${slug}.test.ts`;
          dependencies = ["vitest", "playwright"];
          setupNotes =
            "Install: `npm i -D vitest playwright && npx playwright install chromium`. Run: `npx vitest`.";
          break;
        case "pytest+selenium":
          body = renderPytestSelenium(ctxObj);
          language = "python";
          filename = args.filename ?? `test_${slug}.py`;
          dependencies = ["pytest", "selenium"];
          setupNotes =
            "Install: `pip install pytest selenium`. Ensure a Chrome driver is on PATH. Run: `pytest`.";
          break;
        default:
          throw new RolepodMcpError(
            "invalid_input",
            `Unknown framework "${args.framework}".`,
          );
      }

      const path = await ctx.store.writeReport(runDir, filename, body);

      return ok({
        run_id: runId,
        test_file_path: path,
        language,
        dependencies,
        setup_notes: setupNotes,
        from_replay_bundle: Boolean(bundle),
      });
    });
  },
};

async function loadReplay(bundlePath: string): Promise<ReplayShape> {
  const raw = await readFile(resolve(bundlePath), "utf8");
  return JSON.parse(raw) as ReplayShape;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "scenario"
  );
}

type RenderCtx = {
  args: ScaffoldE2eInput;
  slug: string;
  bundle: ReplayShape | null;
};

function renderPlaywrightTest(c: RenderCtx): string {
  const url = c.bundle?.open?.url ?? c.args.url;
  const stepLines = c.bundle?.steps?.length
    ? c.bundle.steps.map(playwrightStepLine).join("\n")
    : `  // TODO: implement steps for: ${c.args.scenario_nl}`;
  const expectLines = c.bundle?.expect?.length
    ? c.bundle.expect.map(playwrightExpectLine).join("\n")
    : `  // TODO: add expectations`;
  return [
    `import { test, expect } from "@playwright/test";`,
    ``,
    `test(${JSON.stringify(c.args.scenario_nl)}, async ({ page }) => {`,
    `  await page.goto(${JSON.stringify(url)});`,
    stepLines,
    expectLines,
    `});`,
    ``,
  ].join("\n");
}

function renderVitestPlaywright(c: RenderCtx): string {
  const url = c.bundle?.open?.url ?? c.args.url;
  const stepLines = c.bundle?.steps?.length
    ? c.bundle.steps.map(playwrightStepLine).join("\n")
    : `    // TODO: implement steps for: ${c.args.scenario_nl}`;
  const expectLines = c.bundle?.expect?.length
    ? c.bundle.expect.map(playwrightExpectLine).join("\n")
    : `    // TODO: add expectations`;
  return [
    `import { test } from "vitest";`,
    `import { chromium, expect } from "playwright/test";`,
    ``,
    `test(${JSON.stringify(c.args.scenario_nl)}, async () => {`,
    `  const browser = await chromium.launch();`,
    `  const page = await browser.newPage();`,
    `  try {`,
    `    await page.goto(${JSON.stringify(url)});`,
    indent(stepLines, 2),
    indent(expectLines, 2),
    `  } finally {`,
    `    await browser.close();`,
    `  }`,
    `});`,
    ``,
  ].join("\n");
}

function renderPytestSelenium(c: RenderCtx): string {
  const url = c.bundle?.open?.url ?? c.args.url;
  const stepLines = c.bundle?.steps?.length
    ? c.bundle.steps.map(seleniumStepLine).join("\n")
    : `    # TODO: implement steps for: ${c.args.scenario_nl}`;
  const expectLines = c.bundle?.expect?.length
    ? c.bundle.expect.map(seleniumExpectLine).join("\n")
    : `    # TODO: add expectations`;
  return [
    `import pytest`,
    `from selenium import webdriver`,
    `from selenium.webdriver.common.by import By`,
    `from selenium.webdriver.common.keys import Keys`,
    ``,
    `def test_${slugifyPy(c.args.scenario_nl)}():`,
    `    """${c.args.scenario_nl}"""`,
    `    driver = webdriver.Chrome()`,
    `    try:`,
    `        driver.get(${JSON.stringify(url)})`,
    indent(stepLines, 2),
    indent(expectLines, 2),
    `    finally:`,
    `        driver.quit()`,
    ``,
  ].join("\n");
}

function playwrightStepLine(step: Step): string {
  switch (step.kind) {
    case "click":
      return `  await page.getByText(${JSON.stringify(step.query)}, { exact: false }).first().click();`;
    case "type":
      return `  await page.getByRole("textbox", { name: ${JSON.stringify(step.query)} }).fill(${JSON.stringify(step.text)});`;
    case "key":
      return `  await page.keyboard.press(${JSON.stringify(step.key)});`;
    case "navigate":
      return `  await page.goto(${JSON.stringify(step.url)});`;
    case "wait_for":
      return `  // wait_for: ${JSON.stringify(step.condition)} — translate to page.waitForXxx()`;
    default:
      return `  // unsupported step kind: ${step.kind}`;
  }
}

function playwrightExpectLine(exp: Expect): string {
  switch (exp.kind) {
    case "text_visible":
      return `  await expect(page.getByText(${JSON.stringify(exp.text)}, { exact: false }).first()).toBeVisible();`;
    case "text_absent":
      return `  await expect(page.getByText(${JSON.stringify(exp.text)}, { exact: false }).first()).toHaveCount(0);`;
    case "url_matches":
      return `  await expect(page).toHaveURL(new RegExp(${JSON.stringify(exp.pattern)}));`;
    case "ref_in_state":
      return `  // ref_in_state ${JSON.stringify(exp.query)} → ${String(exp.state)} — translate as needed`;
    default:
      return `  // unsupported expect kind: ${exp.kind}`;
  }
}

function seleniumStepLine(step: Step): string {
  switch (step.kind) {
    case "click":
      return `    driver.find_element(By.XPATH, f"//*[contains(text(), \\"${escapePy(String(step.query))}\\")]").click()`;
    case "type":
      return `    driver.find_element(By.XPATH, f"//*[@aria-label=\\"${escapePy(String(step.query))}\\" or @placeholder=\\"${escapePy(String(step.query))}\\"]").send_keys(${JSON.stringify(step.text)})`;
    case "key":
      return `    driver.switch_to.active_element.send_keys(Keys.${pyKeyName(String(step.key))})`;
    case "navigate":
      return `    driver.get(${JSON.stringify(step.url)})`;
    case "wait_for":
      return `    # wait_for: ${JSON.stringify(step.condition)} — translate to WebDriverWait`;
    default:
      return `    # unsupported step kind: ${step.kind}`;
  }
}

function seleniumExpectLine(exp: Expect): string {
  switch (exp.kind) {
    case "text_visible":
      return `    assert ${JSON.stringify(exp.text)} in driver.page_source`;
    case "text_absent":
      return `    assert ${JSON.stringify(exp.text)} not in driver.page_source`;
    case "url_matches":
      return `    import re; assert re.search(${JSON.stringify(exp.pattern)}, driver.current_url)`;
    case "ref_in_state":
      return `    # ref_in_state ${JSON.stringify(exp.query)} → ${String(exp.state)}`;
    default:
      return `    # unsupported expect kind: ${exp.kind}`;
  }
}

function slugifyPy(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "scenario"
  );
}

function escapePy(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function pyKeyName(k: string): string {
  const map: Record<string, string> = {
    Enter: "ENTER",
    Tab: "TAB",
    Escape: "ESCAPE",
    Backspace: "BACK_SPACE",
    ArrowUp: "ARROW_UP",
    ArrowDown: "ARROW_DOWN",
    ArrowLeft: "ARROW_LEFT",
    ArrowRight: "ARROW_RIGHT",
  };
  return map[k] ?? `RETURN  # unknown key: ${k}`;
}

function indent(block: string, n: number): string {
  const pad = " ".repeat(n);
  return block
    .split("\n")
    .map((l) => (l.length > 0 ? pad + l : l))
    .join("\n");
}
