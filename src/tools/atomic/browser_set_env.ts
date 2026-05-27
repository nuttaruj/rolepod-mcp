import { PlaywrightEngine } from "../../engine/PlaywrightEngine.js";
import {
  browserSetEnvShape,
  ToolNames,
  type BrowserSetEnvInput,
} from "../../schema/tools.js";
import { RolepodMcpError } from "../../util/errors.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserSetEnvTool: ToolModule<typeof browserSetEnvShape> = {
  name: ToolNames.browserSetEnv,
  description:
    "Mutate session environment at runtime: viewport, offline state, geolocation, color_scheme (`light`/`dark`), reduced_motion, extra HTTP headers, network throttle preset (`slow-3g`/`fast-3g`/`slow-4g`/`fast-4g`/`offline`/`no-throttling`), and CPU throttle multiplier. `network_throttle` and `cpu_throttle` are chromium-only (CDP). `user_agent`, `locale`, and `timezone` cannot be changed mid-session — set them at `browser_open` time. Invalidates all refs.",
  inputShape: browserSetEnvShape,
  build(ctx) {
    return safeHandler(async (args: BrowserSetEnvInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      if (!(engine instanceof PlaywrightEngine)) {
        throw new RolepodMcpError(
          "unsupported_engine",
          "set_env is web-only and requires PlaywrightEngine.",
        );
      }
      await engine.setEnv(args.session_id, {
        ...(args.viewport !== undefined ? { viewport: args.viewport } : {}),
        ...(args.offline !== undefined ? { offline: args.offline } : {}),
        ...(args.geolocation !== undefined
          ? { geolocation: args.geolocation }
          : {}),
        ...(args.color_scheme !== undefined
          ? { colorScheme: args.color_scheme }
          : {}),
        ...(args.reduced_motion !== undefined
          ? { reducedMotion: args.reduced_motion }
          : {}),
        ...(args.extra_headers !== undefined
          ? { extraHeaders: args.extra_headers }
          : {}),
        ...(args.network_throttle !== undefined
          ? { networkThrottle: args.network_throttle }
          : {}),
        ...(args.cpu_throttle !== undefined
          ? { cpuThrottle: args.cpu_throttle }
          : {}),
      });
      return ok({ applied: true });
    });
  },
};
