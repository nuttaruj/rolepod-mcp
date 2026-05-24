import {
  browserScreenshotShape,
  ToolNames,
  type BrowserScreenshotInput,
} from "../../schema/tools.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserScreenshotTool: ToolModule<typeof browserScreenshotShape> = {
  name: ToolNames.browserScreenshot,
  description:
    "Capture a screenshot and save under ./.rolepod-uiproof/artifacts/{run_id}/. Set `full_page: true` for full-page capture; default is viewport only. Read-only (does NOT invalidate refs).",
  inputShape: browserScreenshotShape,
  build(ctx) {
    return safeHandler(async (args: BrowserScreenshotInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      const { runId, runDir } = await ctx.store.startRun("snap");
      const buf = await engine.screenshot(
        { id: args.session_id, platform: ctx.registry.platformOf(args.session_id) },
        args.full_page ?? false,
      );
      const path = await ctx.store.writeScreenshot(runDir, buf, "shot");
      return ok({
        run_id: runId,
        path,
        width: undefined,
        height: undefined,
        bytes: buf.byteLength,
      });
    });
  },
};
