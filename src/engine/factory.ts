import { RolepodMcpError } from "../util/errors.js";
import { PlaywrightEngine } from "./PlaywrightEngine.js";
import type { Engine } from "./Engine.js";

/**
 * Engine selection happens once at server startup, driven by the
 * `ROLEPOD_MCP_WEB_ENGINE` env var (D-012). v0.1 supports only
 * `playwright`. Selenium lands in v0.4.
 */
export function createEngine(): Engine {
  const choice = (process.env.ROLEPOD_MCP_WEB_ENGINE ?? "playwright").toLowerCase();
  switch (choice) {
    case "playwright":
      return new PlaywrightEngine();
    case "selenium":
      throw new RolepodMcpError(
        "unsupported_engine",
        "SeleniumEngine ships in v0.4 — set ROLEPOD_MCP_WEB_ENGINE=playwright for v0.1.",
        { requested: choice },
      );
    default:
      throw new RolepodMcpError(
        "unsupported_engine",
        `Unknown engine "${choice}" — supported: playwright (v0.1).`,
        { requested: choice },
      );
  }
}
