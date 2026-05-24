import { browserTypeShape, ToolNames, type BrowserTypeInput } from "../../schema/tools.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserTypeTool: ToolModule<typeof browserTypeShape> = {
  name: ToolNames.browserType,
  description:
    "Type `text` into the element identified by `ref`. Set `clear_first: true` to replace the existing value. Invalidates all refs on success.",
  inputShape: browserTypeShape,
  build(ctx) {
    return safeHandler(async (args: BrowserTypeInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      await engine.type(
        { id: args.session_id, platform: "web" },
        args.ref,
        args.text,
        args.clear_first ? { clearFirst: true } : undefined,
      );
      return ok({ typed: true });
    });
  },
};
