import { browserClickShape, ToolNames, type BrowserClickInput } from "../../schema/tools.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserClickTool: ToolModule<typeof browserClickShape> = {
  name: ToolNames.browserClick,
  description:
    "Click the element identified by `ref` from the most recent snapshot. Invalidates all refs on success.",
  inputShape: browserClickShape,
  build(ctx) {
    return safeHandler(async (args: BrowserClickInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      await engine.click(
        { id: args.session_id, platform: "web" },
        args.ref,
        args.button ? { button: args.button } : undefined,
      );
      return ok({ clicked: true });
    });
  },
};
