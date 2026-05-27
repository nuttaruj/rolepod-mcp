import { PlaywrightEngine } from "../../engine/PlaywrightEngine.js";
import {
  browserConsoleShape,
  ToolNames,
  type BrowserConsoleInput,
} from "../../schema/tools.js";
import { RolepodMcpError } from "../../util/errors.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserConsoleTool: ToolModule<typeof browserConsoleShape> = {
  name: ToolNames.browserConsole,
  description:
    "List console messages emitted by the active page since the session opened (or since the last `clear`). Filters: `levels` (default: errors+warnings), substring `contains`, and `limit` (default 50, max 1000). Set `clear: true` to drain the buffer after returning. Read-only.",
  inputShape: browserConsoleShape,
  build(ctx) {
    return safeHandler(async (args: BrowserConsoleInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      if (!(engine instanceof PlaywrightEngine)) {
        throw new RolepodMcpError(
          "unsupported_engine",
          "console is web-only and requires PlaywrightEngine.",
        );
      }
      // Default: errors + warnings only (token-conscious).
      const levels: BrowserConsoleInput["levels"] =
        args.levels && args.levels.length > 0
          ? args.levels
          : ["error", "warning"];
      const messages = engine.getConsole(args.session_id, {
        levels,
        ...(args.contains !== undefined ? { contains: args.contains } : {}),
        clear: args.clear,
        limit: args.limit,
      });
      return ok({
        count: messages.length,
        messages,
      });
    });
  },
};
