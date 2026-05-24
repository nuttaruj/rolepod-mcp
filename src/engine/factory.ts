import { RolepodMcpError } from "../util/errors.js";
import { AppiumEngine } from "./AppiumEngine.js";
import { PlaywrightEngine } from "./PlaywrightEngine.js";
import type { Engine } from "./Engine.js";

/**
 * Engine selection happens once at server startup. v0.3 wires
 * Playwright for `web` and Appium for `ios`/`android`. The
 * `ROLEPOD_MCP_WEB_ENGINE` env var (D-012) only governs the *web*
 * engine; mobile always routes to Appium.
 */
export function createWebEngine(): Engine {
  const choice = (process.env.ROLEPOD_MCP_WEB_ENGINE ?? "playwright").toLowerCase();
  switch (choice) {
    case "playwright":
      return new PlaywrightEngine();
    case "selenium":
      throw new RolepodMcpError(
        "unsupported_engine",
        "SeleniumEngine ships in v0.4 — set ROLEPOD_MCP_WEB_ENGINE=playwright until then.",
        { requested: choice },
      );
    default:
      throw new RolepodMcpError(
        "unsupported_engine",
        `Unknown web engine "${choice}" — supported: playwright.`,
        { requested: choice },
      );
  }
}

export function createMobileEngine(): Engine {
  return new AppiumEngine();
}

/** Back-compat alias for v0.1 callers. */
export function createEngine(): Engine {
  return createWebEngine();
}
