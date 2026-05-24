#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "../src/server.js";
import { log } from "../src/util/log.js";

async function main(): Promise<void> {
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
  log.error("fatal startup error", { err: err instanceof Error ? err.stack : String(err) });
  process.exit(1);
});
