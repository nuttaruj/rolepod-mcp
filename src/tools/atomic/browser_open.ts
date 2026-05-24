import { browserOpenShape, ToolNames, type BrowserOpenInput } from "../../schema/tools.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserOpenTool: ToolModule<typeof browserOpenShape> = {
  name: ToolNames.browserOpen,
  description:
    "Open a new browser or mobile session against a target. v0.1 supports platform='web' only; mobile lands in v0.3.",
  inputShape: browserOpenShape,
  build(ctx) {
    return safeHandler(async (args: BrowserOpenInput) => {
      const session = await ctx.registry.open(args);
      return ok({ session_id: session.id, platform: session.platform });
    });
  },
};
