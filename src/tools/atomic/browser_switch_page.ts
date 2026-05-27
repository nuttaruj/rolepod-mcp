import { PlaywrightEngine } from "../../engine/PlaywrightEngine.js";
import {
  browserSwitchPageShape,
  ToolNames,
  type BrowserSwitchPageInput,
} from "../../schema/tools.js";
import { RolepodMcpError } from "../../util/errors.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserSwitchPageTool: ToolModule<typeof browserSwitchPageShape> = {
  name: ToolNames.browserSwitchPage,
  description:
    "Set the active page for subsequent tool calls. Use `browser_pages` to discover indexes. Switching invalidates all refs because each page has its own DOM. Page 0 is the main page; popups land at higher indexes in the order they opened.",
  inputShape: browserSwitchPageShape,
  build(ctx) {
    return safeHandler(async (args: BrowserSwitchPageInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      if (!(engine instanceof PlaywrightEngine)) {
        throw new RolepodMcpError(
          "unsupported_engine",
          "switch_page is web-only and requires PlaywrightEngine.",
        );
      }
      await engine.switchPage(args.session_id, args.index);
      return ok({ active_index: args.index });
    });
  },
};
