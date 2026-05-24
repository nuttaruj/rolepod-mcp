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
} as const;
export const verifyUiFlowSchema = z.object(verifyUiFlowShape);
export type VerifyUiFlowInput = z.infer<typeof verifyUiFlowSchema>;

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
  verifyUiFlow: "rolepod_verify_ui_flow",
} as const;

export type ToolName = (typeof ToolNames)[keyof typeof ToolNames];
