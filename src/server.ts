import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ArtifactStore } from "./artifact/ArtifactStore.js";
import { createMobileEngine, createWebEngine } from "./engine/factory.js";
import { SessionRegistry } from "./session/SessionRegistry.js";
import { browserClickTool } from "./tools/atomic/browser_click.js";
import { browserCloseTool } from "./tools/atomic/browser_close.js";
import { browserConsoleTool } from "./tools/atomic/browser_console.js";
import { browserDragTool } from "./tools/atomic/browser_drag.js";
import { browserEvaluateTool } from "./tools/atomic/browser_evaluate.js";
import { browserFillFormTool } from "./tools/atomic/browser_fill_form.js";
import { browserHandleDialogTool } from "./tools/atomic/browser_handle_dialog.js";
import { browserHoverTool } from "./tools/atomic/browser_hover.js";
import { browserKeyTool } from "./tools/atomic/browser_key.js";
import { browserNavigateTool } from "./tools/atomic/browser_navigate.js";
import { browserNetworkTool } from "./tools/atomic/browser_network.js";
import { browserOpenTool } from "./tools/atomic/browser_open.js";
import { browserPagesTool } from "./tools/atomic/browser_pages.js";
import { browserScreenshotTool } from "./tools/atomic/browser_screenshot.js";
import { browserScrollTool } from "./tools/atomic/browser_scroll.js";
import { browserSetEnvTool } from "./tools/atomic/browser_set_env.js";
import { browserSnapshotTool } from "./tools/atomic/browser_snapshot.js";
import { browserSwitchPageTool } from "./tools/atomic/browser_switch_page.js";
import { browserTypeTool } from "./tools/atomic/browser_type.js";
import { browserUploadFileTool } from "./tools/atomic/browser_upload_file.js";
import { browserWaitForTool } from "./tools/atomic/browser_wait_for.js";
import { auditA11yTool } from "./tools/composite/audit_a11y.js";
import { extractUiStateTool } from "./tools/composite/extract_ui_state.js";
import { scaffoldE2eTool } from "./tools/composite/scaffold_e2e.js";
import { verifyUiFlowTool } from "./tools/composite/verify_ui_flow.js";
import { visualDiffTool } from "./tools/composite/visual_diff.js";
import { toolMetadata } from "./tools/metadata.js";
import type { ToolContext } from "./tools/types.js";
import { log } from "./util/log.js";

export const SERVER_NAME = "rolepod-uiproof";
export const SERVER_VERSION = "0.5.0";

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
  const webEngine = createWebEngine();
  const registry = new SessionRegistry({ idleTimeoutMs: opts.idleTimeoutMs });
  registry.register("web", webEngine);
  // Mobile engines are lazy — the webdriverio import only fires when an
  // `ios`/`android` session is actually opened. So registering Appium
  // unconditionally is safe for web-only installs.
  const mobileEngine = createMobileEngine();
  registry.register("ios", mobileEngine);
  registry.register("android", mobileEngine);

  const storeOpts: ConstructorParameters<typeof ArtifactStore>[0] = {};
  if (opts.artifactRoot !== undefined) storeOpts.rootDir = opts.artifactRoot;
  const store = new ArtifactStore(storeOpts);

  const ctx: ToolContext = { registry, store };

  const mcp = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  const tools = [
    // atomic (v0.1-v0.4)
    browserOpenTool,
    browserCloseTool,
    browserSnapshotTool,
    browserClickTool,
    browserTypeTool,
    browserKeyTool,
    browserScrollTool,
    browserWaitForTool,
    browserScreenshotTool,
    browserNavigateTool,
    // atomic (v0.5)
    browserHoverTool,
    browserDragTool,
    browserFillFormTool,
    browserUploadFileTool,
    browserHandleDialogTool,
    browserConsoleTool,
    browserNetworkTool,
    browserSetEnvTool,
    browserEvaluateTool,
    browserPagesTool,
    browserSwitchPageTool,
    // composite
    verifyUiFlowTool,
    auditA11yTool,
    visualDiffTool,
    scaffoldE2eTool,
    extractUiStateTool,
  ] as const;

  for (const t of tools) {
    const meta = toolMetadata[t.name as keyof typeof toolMetadata];
    mcp.registerTool(
      t.name,
      {
        title: meta?.title,
        description: t.description,
        inputSchema: t.inputShape,
        annotations: meta?.annotations,
      },
      t.build(ctx) as Parameters<typeof mcp.registerTool>[2],
    );
  }

  log.info("rolepod-uiproof server built", {
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
