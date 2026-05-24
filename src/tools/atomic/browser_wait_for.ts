import {
  browserWaitForShape,
  ToolNames,
  type BrowserWaitForInput,
} from "../../schema/tools.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserWaitForTool: ToolModule<typeof browserWaitForShape> = {
  name: ToolNames.browserWaitFor,
  description:
    "Wait until a condition holds: text_visible, ref_exists, url_matches, or idle. Defaults to a 10s timeout. Invalidates all refs on success.",
  inputShape: browserWaitForShape,
  build(ctx) {
    return safeHandler(async (args: BrowserWaitForInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      const start = Date.now();
      await engine.waitFor(
        { id: args.session_id, platform: ctx.registry.platformOf(args.session_id) },
        args.condition,
        args.timeout_ms,
      );
      return ok({ matched: true, waited_ms: Date.now() - start });
    });
  },
};
