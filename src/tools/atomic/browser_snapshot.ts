import {
  browserSnapshotShape,
  ToolNames,
  type BrowserSnapshotInput,
} from "../../schema/tools.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserSnapshotTool: ToolModule<typeof browserSnapshotShape> = {
  name: ToolNames.browserSnapshot,
  description:
    "Return the current accessibility tree with stable refs (e1, e2, …). Refs are valid only until the next state-changing call (D-010).",
  inputShape: browserSnapshotShape,
  build(ctx) {
    return safeHandler(async (args: BrowserSnapshotInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      const snap = await engine.snapshot(
        { id: args.session_id, platform: ctx.registry.platformOf(args.session_id) },
        args.mode,
      );
      return ok({
        session_id: snap.session_id,
        url_or_screen: snap.url_or_screen,
        tree: snap.tree,
        taken_at: snap.taken_at,
      });
    });
  },
};
