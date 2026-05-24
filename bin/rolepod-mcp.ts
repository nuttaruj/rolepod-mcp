#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { runDoctor } from "../src/cli/doctor.js";
import { runInstallMobile } from "../src/cli/install_mobile.js";
import { runReplay } from "../src/cli/replay.js";
import { buildServer, SERVER_VERSION } from "../src/server.js";
import { log } from "../src/util/log.js";

const HELP = `rolepod-mcp ${SERVER_VERSION}

Usage:
  rolepod-mcp                 Start the MCP server on stdio (default)
  rolepod-mcp doctor          Health check (Node, Playwright, Appium, SDKs)
  rolepod-mcp install:mobile  Print mobile setup checklist (iOS / Android)
  rolepod-mcp replay <file>   Re-run a verify_ui_flow replay bundle
  rolepod-mcp --version       Print version
  rolepod-mcp --help          This help
`;

async function main(): Promise<void> {
  const [, , sub, ...rest] = process.argv;

  switch (sub) {
    case undefined:
    case "serve":
      return startServer();
    case "doctor":
      process.exit(await runDoctor());
      return;
    case "install:mobile":
    case "install":
      process.exit(runInstallMobile());
      return;
    case "replay": {
      const target = rest[0];
      if (!target) {
        process.stderr.write("Usage: rolepod-mcp replay <bundle.json>\n");
        process.exit(2);
      }
      process.exit(await runReplay(target));
      return;
    }
    case "--version":
    case "-v":
      process.stdout.write(`${SERVER_VERSION}\n`);
      return;
    case "--help":
    case "-h":
    case "help":
      process.stdout.write(HELP);
      return;
    default:
      process.stderr.write(`Unknown subcommand: ${sub}\n${HELP}`);
      process.exit(2);
  }
}

async function startServer(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();

  const shutdown = async (signal: NodeJS.Signals) => {
    log.info("shutting down", { signal });
    await server.shutdown().catch((err: unknown) =>
      log.error("shutdown failed", { err: String(err) }),
    );
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await server.mcp.connect(transport);
  log.info("rolepod-mcp connected on stdio");
}

main().catch((err: unknown) => {
  log.error("fatal startup error", {
    err: err instanceof Error ? err.stack : String(err),
  });
  process.exit(1);
});
