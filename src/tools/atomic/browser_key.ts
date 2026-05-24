import { browserKeyShape, ToolNames, type BrowserKeyInput } from "../../schema/tools.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserKeyTool: ToolModule<typeof browserKeyShape> = {
  name: ToolNames.browserKey,
  description:
    "Press a single key (e.g. 'Enter', 'Tab', 'Escape'). Invalidates all refs on success.",
  inputShape: browserKeyShape,
  build(ctx) {
    return safeHandler(async (args: BrowserKeyInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      await engine.key({ id: args.session_id, platform: ctx.registry.platformOf(args.session_id) }, args.key);
      return ok({ pressed: true });
    });
  },
};
