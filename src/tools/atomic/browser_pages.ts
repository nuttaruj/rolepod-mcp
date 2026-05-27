import { PlaywrightEngine } from "../../engine/PlaywrightEngine.js";
import {
  browserPagesShape,
  ToolNames,
  type BrowserPagesInput,
} from "../../schema/tools.js";
import { RolepodMcpError } from "../../util/errors.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserPagesTool: ToolModule<typeof browserPagesShape> = {
  name: ToolNames.browserPages,
  description:
    "List all pages currently open in the session's browser context — typically just the main page, plus any popups, OAuth windows, or `target=_blank` tabs that the page itself opened. Each entry carries `{ index, url, title, active }`. Read-only.",
  inputShape: browserPagesShape,
  build(ctx) {
    return safeHandler(async (args: BrowserPagesInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      if (!(engine instanceof PlaywrightEngine)) {
        throw new RolepodMcpError(
          "unsupported_engine",
          "pages is web-only and requires PlaywrightEngine.",
        );
      }
      const raw = engine.listPages(args.session_id);
      // Resolve titles (best-effort — closed pages reject).
      const pages = await Promise.all(
        raw.map(async (p) => ({
          index: p.index,
          url: p.url,
          title: await p.title_promise.catch(() => ""),
          active: p.active,
        })),
      );
      return ok({ count: pages.length, pages });
    });
  },
};
