import {
  browserDragShape,
  ToolNames,
  type BrowserDragInput,
} from "../../schema/tools.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserDragTool: ToolModule<typeof browserDragShape> = {
  name: ToolNames.browserDrag,
  description:
    "Drag the element identified by `from_ref` onto the element identified by `to_ref`. Both refs come from the most recent snapshot. Invalidates all refs on success.",
  inputShape: browserDragShape,
  build(ctx) {
    return safeHandler(async (args: BrowserDragInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      await engine.drag(
        {
          id: args.session_id,
          platform: ctx.registry.platformOf(args.session_id),
        },
        args.from_ref,
        args.to_ref,
      );
      return ok({ dragged: true });
    });
  },
};
