import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ArtifactStore } from "../artifact/ArtifactStore.js";
import { createMobileEngine, createWebEngine } from "../engine/factory.js";
import { SessionRegistry } from "../session/SessionRegistry.js";
import { verifyUiFlowTool } from "../tools/composite/verify_ui_flow.js";
import type { ToolContext } from "../tools/types.js";

/**
 * `rolepod-mcp replay <bundle.json>` — re-runs a verify_ui_flow
 * replay bundle deterministically, with no agent in the loop. Exit
 * code 0 = passed, 1 = failed or error.
 */
export async function runReplay(bundlePath: string): Promise<number> {
  const abs = resolve(bundlePath);
  const raw = await readFile(abs, "utf8");
  const bundle = JSON.parse(raw) as Record<string, unknown>;
  if (bundle.version !== 1) {
    process.stderr.write(`Unsupported replay bundle version: ${bundle.version}\n`);
    return 1;
  }

  const webEngine = createWebEngine();
  const registry = new SessionRegistry({ idleTimeoutMs: 0 });
  registry.register("web", webEngine);
  const mobileEngine = createMobileEngine();
  registry.register("ios", mobileEngine);
  registry.register("android", mobileEngine);
  const store = new ArtifactStore();
  const ctx: ToolContext = { registry, store };

  try {
    const handler = verifyUiFlowTool.build(ctx);
    const result = await handler({
      mode: "assert",
      open: (bundle.open as Record<string, unknown>) ?? {},
      steps:
        (bundle.steps as Array<{ kind: string }> | undefined) ?? [],
      expect:
        (bundle.expect as Array<{ kind: string }> | undefined) ?? [],
      capture: ["screenshot"],
      close_on_finish: true,
      minimize: false,
    } as Parameters<ReturnType<typeof verifyUiFlowTool.build>>[0]);
    const body = result.structuredContent as Record<string, unknown>;
    process.stdout.write(JSON.stringify(body, null, 2) + "\n");
    return body.passed === true ? 0 : 1;
  } finally {
    await registry.shutdown().catch(() => undefined);
  }
}
