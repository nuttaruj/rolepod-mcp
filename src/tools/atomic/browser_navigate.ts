import {
  browserNavigateShape,
  ToolNames,
  type BrowserNavigateInput,
} from "../../schema/tools.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserNavigateTool: ToolModule<typeof browserNavigateShape> = {
  name: ToolNames.browserNavigate,
  description:
    "Navigate the session to a new URL (web only). Invalidates all refs on success.",
  inputShape: browserNavigateShape,
  build(ctx) {
    return safeHandler(async (args: BrowserNavigateInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      await engine.navigate({ id: args.session_id, platform: "web" }, args.url);
      return ok({ navigated: true, url: args.url });
    });
  },
};
