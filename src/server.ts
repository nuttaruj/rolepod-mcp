import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ArtifactStore } from "./artifact/ArtifactStore.js";
import { createEngine } from "./engine/factory.js";
import { SessionRegistry } from "./session/SessionRegistry.js";
import { browserClickTool } from "./tools/atomic/browser_click.js";
import { browserCloseTool } from "./tools/atomic/browser_close.js";
import { browserOpenTool } from "./tools/atomic/browser_open.js";
import { browserSnapshotTool } from "./tools/atomic/browser_snapshot.js";
import { browserTypeTool } from "./tools/atomic/browser_type.js";
import { verifyUiFlowTool } from "./tools/composite/verify_ui_flow.js";
import type { ToolContext } from "./tools/types.js";
import { log } from "./util/log.js";

export const SERVER_NAME = "rolepod-mcp";
export const SERVER_VERSION = "0.1.0";

export type ServerHandle = {
  mcp: McpServer;
  registry: SessionRegistry;
  store: ArtifactStore;
  shutdown(): Promise<void>;
};

/**
 * Build the MCP server with every v0.1 tool registered. Caller is
 * responsible for choosing a transport (stdio for production, in-memory
 * for tests) and invoking `mcp.connect(transport)`.
 */
export function buildServer(
  opts: { artifactRoot?: string; idleTimeoutMs?: number } = {},
): ServerHandle {
  const engine = createEngine();
  const registry = new SessionRegistry({ idleTimeoutMs: opts.idleTimeoutMs });
  registry.register("web", engine);

  const storeOpts: ConstructorParameters<typeof ArtifactStore>[0] = {};
  if (opts.artifactRoot !== undefined) storeOpts.rootDir = opts.artifactRoot;
  const store = new ArtifactStore(storeOpts);

  const ctx: ToolContext = { registry, store };

  const mcp = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  const tools = [
    browserOpenTool,
    browserCloseTool,
    browserSnapshotTool,
    browserClickTool,
    browserTypeTool,
    verifyUiFlowTool,
  ] as const;

  for (const t of tools) {
    mcp.registerTool(
      t.name,
      { description: t.description, inputSchema: t.inputShape },
      t.build(ctx) as Parameters<typeof mcp.registerTool>[2],
    );
  }

  log.info("rolepod-mcp server built", {
    version: SERVER_VERSION,
    tools: tools.map((t) => t.name),
  });

  return {
    mcp,
    registry,
    store,
    async shutdown() {
      await registry.shutdown();
      await mcp.close().catch(() => undefined);
    },
  };
}
