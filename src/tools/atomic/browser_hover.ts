import {
  browserHoverShape,
  ToolNames,
  type BrowserHoverInput,
} from "../../schema/tools.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserHoverTool: ToolModule<typeof browserHoverShape> = {
  name: ToolNames.browserHover,
  description:
    "Hover the pointer over the element identified by `ref`. Refs remain valid afterwards (read-mostly).",
  inputShape: browserHoverShape,
  build(ctx) {
    return safeHandler(async (args: BrowserHoverInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      await engine.hover(
        {
          id: args.session_id,
          platform: ctx.registry.platformOf(args.session_id),
        },
        args.ref,
      );
      return ok({ hovered: true });
    });
  },
};
