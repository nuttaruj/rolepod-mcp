import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

export const platformSchema = z.enum(["web", "ios", "android"]);
export const browserSchema = z.enum(["chromium", "firefox", "webkit"]);

export const viewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const bboxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const a11yStateSchema = z.object({
  focused: z.boolean().optional(),
  selected: z.boolean().optional(),
  expanded: z.boolean().optional(),
  disabled: z.boolean().optional(),
});

export type A11yNode = {
  ref: string;
  role: string;
  name?: string;
  value?: string;
  state?: z.infer<typeof a11yStateSchema>;
  bbox?: z.infer<typeof bboxSchema>;
  children?: A11yNode[];
};

export const a11yNodeSchema: z.ZodType<A11yNode> = z.lazy(() =>
  z.object({
    ref: z.string(),
    role: z.string(),
    name: z.string().optional(),
    value: z.string().optional(),
    state: a11yStateSchema.optional(),
    bbox: bboxSchema.optional(),
    children: z.array(a11yNodeSchema).optional(),
  }),
);

export const waitConditionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text_visible"), text: z.string() }),
  z.object({ kind: z.literal("ref_exists"), query: z.string() }),
  z.object({ kind: z.literal("url_matches"), pattern: z.string() }),
  z.object({ kind: z.literal("idle"), ms: z.number().int().positive() }),
]);

// ---------------------------------------------------------------------------
// Atomic tools — input shapes
//
// NOTE: MCP SDK's `registerTool({ inputSchema })` expects a Zod *raw shape*
// (a plain object whose values are Zod schemas), NOT a `z.object(...)`. We
// export both the raw shape (for the SDK) and a derived `z.object` (for
// internal parsing / type inference).
// ---------------------------------------------------------------------------

export const browserOpenShape = {
  platform: platformSchema.default("web"),
  url: z.string().url().optional(),
  browser: browserSchema.optional(),
  viewport: viewportSchema.optional(),
  // mobile fields kept for forward compat; v0.1 only handles platform='web'
  bundle_id: z.string().optional(),
  device: z.string().optional(),
  app_package: z.string().optional(),
  app_activity: z.string().optional(),
  emulator: z.string().optional(),
  headless: z.boolean().optional(),
  user_agent: z.string().optional(),
  locale: z.string().optional(),
} as const;
export const browserOpenSchema = z.object(browserOpenShape);
export type BrowserOpenInput = z.infer<typeof browserOpenSchema>;

export const browserCloseShape = {
  session_id: z.string().min(1),
} as const;
export const browserCloseSchema = z.object(browserCloseShape);
export type BrowserCloseInput = z.infer<typeof browserCloseSchema>;

export const browserSnapshotShape = {
  session_id: z.string().min(1),
  mode: z.enum(["visible", "full"]).optional(),
} as const;
export const browserSnapshotSchema = z.object(browserSnapshotShape);
export type BrowserSnapshotInput = z.infer<typeof browserSnapshotSchema>;

export const browserClickShape = {
  session_id: z.string().min(1),
  ref: z.string().min(1),
  button: z.enum(["left", "right", "middle"]).optional(),
} as const;
export const browserClickSchema = z.object(browserClickShape);
export type BrowserClickInput = z.infer<typeof browserClickSchema>;

export const browserTypeShape = {
  session_id: z.string().min(1),
  ref: z.string().min(1),
  text: z.string(),
  clear_first: z.boolean().optional(),
} as const;
export const browserTypeSchema = z.object(browserTypeShape);
export type BrowserTypeInput = z.infer<typeof browserTypeSchema>;

export const browserKeyShape = {
  session_id: z.string().min(1),
  key: z.string().min(1),
} as const;
export const browserKeySchema = z.object(browserKeyShape);
export type BrowserKeyInput = z.infer<typeof browserKeySchema>;

export const browserScrollShape = {
  session_id: z.string().min(1),
  direction: z.enum(["up", "down", "left", "right"]),
  amount: z.number().int().positive().optional(),
  ref: z.string().min(1).optional(),
} as const;
export const browserScrollSchema = z.object(browserScrollShape);
export type BrowserScrollInput = z.infer<typeof browserScrollSchema>;

export const browserWaitForShape = {
  session_id: z.string().min(1),
  condition: waitConditionSchema,
  timeout_ms: z.number().int().positive().optional(),
} as const;
export const browserWaitForSchema = z.object(browserWaitForShape);
export type BrowserWaitForInput = z.infer<typeof browserWaitForSchema>;

export const browserScreenshotShape = {
  session_id: z.string().min(1),
  full_page: z.boolean().optional(),
} as const;
export const browserScreenshotSchema = z.object(browserScreenshotShape);
export type BrowserScreenshotInput = z.infer<typeof browserScreenshotSchema>;

export const browserNavigateShape = {
  session_id: z.string().min(1),
  url: z.string().url(),
} as const;
export const browserNavigateSchema = z.object(browserNavigateShape);
export type BrowserNavigateInput = z.infer<typeof browserNavigateSchema>;

// ---------------------------------------------------------------------------
// Composite verify_ui_flow
//
// v0.1: only `mode: 'assert'` is implemented. `mode: 'reproduce'` (with
// step minimization) is scheduled for v0.2 — the schema accepts the field
// so callers can be forward-compatible, but the handler rejects anything
// other than 'assert' for now.
// ---------------------------------------------------------------------------

export const verifyStepSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("click"), query: z.string() }),
  z.object({
    kind: z.literal("type"),
    query: z.string(),
    text: z.string(),
    clear_first: z.boolean().optional(),
  }),
  z.object({ kind: z.literal("key"), key: z.string() }),
  z.object({ kind: z.literal("wait_for"), condition: waitConditionSchema }),
  z.object({ kind: z.literal("navigate"), url: z.string().url() }),
]);

export const verifyExpectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text_visible"), text: z.string() }),
  z.object({ kind: z.literal("text_absent"), text: z.string() }),
  z.object({ kind: z.literal("url_matches"), pattern: z.string() }),
  z.object({
    kind: z.literal("ref_in_state"),
    query: z.string(),
    state: z.enum(["visible", "enabled", "focused"]),
  }),
]);

export const captureKindSchema = z.enum([
  "screenshot",
  "har",
  "console",
  "a11y_tree",
  "video",
]);

export const verifyUiFlowShape = {
  mode: z.enum(["assert", "reproduce"]).default("assert"),
  open: browserOpenSchema,
  steps: z.array(verifyStepSchema).default([]),
  expect: z.array(verifyExpectSchema).default([]),
  capture: z.array(captureKindSchema).optional(),
  close_on_finish: z.boolean().default(true),
  /**
   * Only consulted when `mode='reproduce'`. When true (default) and the
   * initial run reproduces the bug, the composite tries to remove each
   * step in turn and re-runs to find a smaller reproducer.
   */
  minimize: z.boolean().default(true),
} as const;
export const verifyUiFlowSchema = z.object(verifyUiFlowShape);
export type VerifyUiFlowInput = z.infer<typeof verifyUiFlowSchema>;

// ---------------------------------------------------------------------------
// audit_a11y
// ---------------------------------------------------------------------------

export const wcagLevelSchema = z.enum(["wcag-a", "wcag-aa", "wcag-aaa"]);
export const a11ySeveritySchema = z.enum([
  "critical",
  "serious",
  "moderate",
  "minor",
]);
export const auditScopeSchema = z.union([
  z.literal("page"),
  z.object({ ref: z.string().min(1) }),
]);

export const auditA11yShape = {
  open: browserOpenSchema,
  level: wcagLevelSchema.default("wcag-aa"),
  scope: auditScopeSchema.default("page"),
  report_format: z.enum(["json", "markdown"]).default("json"),
  close_on_finish: z.boolean().default(true),
} as const;
export const auditA11ySchema = z.object(auditA11yShape);
export type AuditA11yInput = z.infer<typeof auditA11ySchema>;

// ---------------------------------------------------------------------------
// visual_diff
// ---------------------------------------------------------------------------

export const visualDiffShape = {
  open: browserOpenSchema,
  baseline_id: z.string().min(1),
  viewport: viewportSchema.optional(),
  threshold_pct: z.number().min(0).max(1).default(0.1),
  close_on_finish: z.boolean().default(true),
  /** Pixel sensitivity for pixelmatch (0 = strict, 1 = lax). Default 0.1. */
  pixel_threshold: z.number().min(0).max(1).default(0.1),
} as const;
export const visualDiffSchema = z.object(visualDiffShape);
export type VisualDiffInput = z.infer<typeof visualDiffSchema>;

// ---------------------------------------------------------------------------
// scaffold_e2e
// ---------------------------------------------------------------------------

export const e2eFrameworkSchema = z.enum([
  "playwright-test",
  "vitest+playwright",
  "pytest+selenium",
]);

export const scaffoldE2eShape = {
  framework: e2eFrameworkSchema,
  scenario_nl: z.string().min(1),
  url: z.string().url(),
  recorded_bundle: z.string().min(1).optional(),
  /** Override the generated test file name. */
  filename: z.string().min(1).optional(),
} as const;
export const scaffoldE2eSchema = z.object(scaffoldE2eShape);
export type ScaffoldE2eInput = z.infer<typeof scaffoldE2eSchema>;

// ---------------------------------------------------------------------------
// extract_ui_state — used internally by other shipped skills (not user-facing).
// ---------------------------------------------------------------------------

export const extractUiStateShape = {
  session_id: z.string().min(1).optional(),
  open: browserOpenSchema.optional(),
  question_nl: z.string().min(1),
  close_on_finish: z.boolean().default(false),
} as const;
export const extractUiStateSchema = z.object(extractUiStateShape);
export type ExtractUiStateInput = z.infer<typeof extractUiStateSchema>;

// ---------------------------------------------------------------------------
// Tool name registry — single source of truth for tool naming.
// All names are prefixed `rolepod_*` per brief 03-tool-surface.md.
// ---------------------------------------------------------------------------

export const ToolNames = {
  browserOpen: "rolepod_browser_open",
  browserClose: "rolepod_browser_close",
  browserSnapshot: "rolepod_browser_snapshot",
  browserClick: "rolepod_browser_click",
  browserType: "rolepod_browser_type",
  browserKey: "rolepod_browser_key",
  browserScroll: "rolepod_browser_scroll",
  browserWaitFor: "rolepod_browser_wait_for",
  browserScreenshot: "rolepod_browser_screenshot",
  browserNavigate: "rolepod_browser_navigate",
  verifyUiFlow: "rolepod_verify_ui_flow",
  auditA11y: "rolepod_audit_a11y",
  visualDiff: "rolepod_visual_diff",
  scaffoldE2e: "rolepod_scaffold_e2e",
  extractUiState: "rolepod_extract_ui_state",
} as const;

export type ToolName = (typeof ToolNames)[keyof typeof ToolNames];
