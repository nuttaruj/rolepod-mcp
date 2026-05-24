import { browserCloseShape, ToolNames, type BrowserCloseInput } from "../../schema/tools.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserCloseTool: ToolModule<typeof browserCloseShape> = {
  name: ToolNames.browserClose,
  description: "Close an open session and free its browser / driver resources.",
  inputShape: browserCloseShape,
  build(ctx) {
    return safeHandler(async (args: BrowserCloseInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      await ctx.registry.close({ id: args.session_id, platform: engine.id === "appium" ? "android" : "web" });
      return ok({ closed: true });
    });
  },
};
