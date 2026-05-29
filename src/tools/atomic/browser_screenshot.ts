import { PlaywrightEngine } from "../../engine/PlaywrightEngine.js";
import {
  browserScreenshotShape,
  ToolNames,
  type BrowserScreenshotInput,
} from "../../schema/tools.js";
import { RolepodMcpError } from "../../util/errors.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserScreenshotTool: ToolModule<typeof browserScreenshotShape> = {
  name: ToolNames.browserScreenshot,
  description:
    "Capture a screenshot and save under ./.rolepod-uiproof/artifacts/{run_id}/. Set `full_page: true` for full-page capture (default viewport only), or `selector` to capture a single element's bounding box. `freeze_motion` disables animations + hides the caret for a deterministic capture. Read-only (does NOT invalidate refs).",
  inputShape: browserScreenshotShape,
  build(ctx) {
    return safeHandler(async (args: BrowserScreenshotInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      const handle = {
        id: args.session_id,
        platform: ctx.registry.platformOf(args.session_id),
      };
      const { runId, runDir } = await ctx.store.startRun("snap");

      let buf: Buffer;
      if (args.selector) {
        if (!(engine instanceof PlaywrightEngine)) {
          throw new RolepodMcpError(
            "unsupported_engine",
            "selector-scoped screenshot is web-only and requires PlaywrightEngine.",
          );
        }
        buf = await engine.screenshotElement(handle, args.selector, {
          freezeMotion: args.freeze_motion,
        });
      } else {
        buf = await engine.screenshot(handle, args.full_page ?? false, {
          freezeMotion: args.freeze_motion,
        });
      }

      const path = await ctx.store.writeScreenshot(runDir, buf, "shot");
      // PNG IHDR: width/height are big-endian uint32 at byte offsets 16/20.
      const isPng = buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47;
      return ok({
        run_id: runId,
        path,
        width: isPng ? buf.readUInt32BE(16) : undefined,
        height: isPng ? buf.readUInt32BE(20) : undefined,
        bytes: buf.byteLength,
      });
    });
  },
};
