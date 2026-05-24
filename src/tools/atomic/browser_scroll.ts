import { browserScrollShape, ToolNames, type BrowserScrollInput } from "../../schema/tools.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserScrollTool: ToolModule<typeof browserScrollShape> = {
  name: ToolNames.browserScroll,
  description:
    "Scroll the page (or a specific scrollable element when `ref` is set) by `amount` pixels in `direction`. Invalidates all refs on success.",
  inputShape: browserScrollShape,
  build(ctx) {
    return safeHandler(async (args: BrowserScrollInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      await engine.scroll(
        { id: args.session_id, platform: ctx.registry.platformOf(args.session_id) },
        args.direction,
        args.amount,
        args.ref,
      );
      return ok({ scrolled: true });
    });
  },
};
