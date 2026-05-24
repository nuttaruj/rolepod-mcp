import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { PlaywrightEngine } from "../../engine/PlaywrightEngine.js";
import {
  ToolNames,
  visualDiffShape,
  type VisualDiffInput,
} from "../../schema/tools.js";
import { RolepodMcpError } from "../../util/errors.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const visualDiffTool: ToolModule<typeof visualDiffShape> = {
  name: ToolNames.visualDiff,
  description:
    "Capture a screenshot and compare against a named baseline under ./.rolepod-mcp/baselines/. First call for a baseline_id seeds the baseline (passed=true, diff_pct=0). Subsequent calls return the diff percentage and an annotated diff image.",
  inputShape: visualDiffShape,
  build(ctx) {
    return safeHandler(async (args: VisualDiffInput) => {
      const { runId, runDir } = await ctx.store.startRun("vdiff");
      const session = await ctx.registry.open({
        ...args.open,
        ...(args.viewport ? { viewport: args.viewport } : {}),
      });
      const engine = ctx.registry.engineFor(session.id);
      if (!(engine instanceof PlaywrightEngine)) {
        throw new RolepodMcpError(
          "unsupported_engine",
          "visual_diff currently requires PlaywrightEngine.",
        );
      }

      try {
        const buf = await engine.screenshot(
          { id: session.id, platform: session.platform },
          true,
        );
        const currentPath = await ctx.store.writeScreenshot(runDir, buf, "current");

        await ctx.store.ensureDir(ctx.store.baselineDir);
        const baselinePath = resolve(
          ctx.store.baselineDir,
          `${args.baseline_id}.png`,
        );

        if (!existsSync(baselinePath)) {
          await ctx.store.writeBytes(
            ctx.store.baselineDir,
            `${args.baseline_id}.png`,
            buf,
          );
          return ok({
            run_id: runId,
            baseline_id: args.baseline_id,
            diff_pct: 0,
            passed: true,
            baseline_path: baselinePath,
            current_path: currentPath,
            note: "Baseline did not exist — current capture saved as the new baseline.",
          });
        }

        const [baselineRaw, currentRaw] = await Promise.all([
          readFile(baselinePath),
          readFile(currentPath),
        ]);
        const baseline = PNG.sync.read(baselineRaw);
        const current = PNG.sync.read(currentRaw);

        if (baseline.width !== current.width || baseline.height !== current.height) {
          throw new RolepodMcpError(
            "engine_error",
            `Dimension mismatch for baseline "${args.baseline_id}" — baseline ${baseline.width}x${baseline.height}, current ${current.width}x${current.height}. Delete the baseline or pass a matching viewport.`,
            {
              baseline: { w: baseline.width, h: baseline.height },
              current: { w: current.width, h: current.height },
            },
          );
        }

        const diff = new PNG({ width: baseline.width, height: baseline.height });
        const diffPixels = pixelmatch(
          baseline.data,
          current.data,
          diff.data,
          baseline.width,
          baseline.height,
          { threshold: args.pixel_threshold, includeAA: true },
        );
        const total = baseline.width * baseline.height;
        const diffPct = diffPixels / total;

        const diffImagePath = await ctx.store.writeBytes(
          runDir,
          "diff.png",
          PNG.sync.write(diff),
        );

        return ok({
          run_id: runId,
          baseline_id: args.baseline_id,
          diff_pct: Number(diffPct.toFixed(6)),
          diff_pixels: diffPixels,
          total_pixels: total,
          passed: diffPct <= args.threshold_pct,
          baseline_path: baselinePath,
          current_path: currentPath,
          diff_image_path: diffImagePath,
        });
      } finally {
        if (args.close_on_finish) {
          await ctx.registry.close(session).catch(() => undefined);
        }
      }
    });
  },
};
