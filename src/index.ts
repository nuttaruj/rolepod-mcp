// Public library surface — re-export pieces consumers might want to embed
// programmatically (e.g. running the server in-process for tests).
export { buildServer, SERVER_NAME, SERVER_VERSION } from "./server.js";
export type { ServerHandle } from "./server.js";
export { ArtifactStore } from "./artifact/ArtifactStore.js";
export { SessionRegistry } from "./session/SessionRegistry.js";
export { PlaywrightEngine } from "./engine/PlaywrightEngine.js";
export { AppiumEngine } from "./engine/AppiumEngine.js";
export { createEngine, createWebEngine, createMobileEngine } from "./engine/factory.js";
export type {
  Engine,
  Session,
  OpenOptions,
  A11ySnapshot,
  WaitCondition,
  Platform,
} from "./engine/Engine.js";
export type { A11yNode, ToolName } from "./schema/tools.js";
export {
  ToolNames,
  // raw shapes (for MCP SDK registerTool consumers)
  browserOpenShape,
  browserCloseShape,
  browserSnapshotShape,
  browserClickShape,
  browserTypeShape,
  browserKeyShape,
  browserScrollShape,
  browserWaitForShape,
  browserScreenshotShape,
  browserNavigateShape,
  verifyUiFlowShape,
  auditA11yShape,
  visualDiffShape,
  scaffoldE2eShape,
  extractUiStateShape,
  // z.object() schemas (for json-schema export / parsing)
  browserOpenSchema,
  browserCloseSchema,
  browserSnapshotSchema,
  browserClickSchema,
  browserTypeSchema,
  browserKeySchema,
  browserScrollSchema,
  browserWaitForSchema,
  browserScreenshotSchema,
  browserNavigateSchema,
  verifyUiFlowSchema,
  auditA11ySchema,
  visualDiffSchema,
  scaffoldE2eSchema,
  extractUiStateSchema,
} from "./schema/tools.js";
export {
  RolepodMcpError,
  StaleRefError,
  UnknownRefError,
  UnknownSessionError,
  UnsupportedPlatformError,
} from "./util/errors.js";
