# 03 — Tool Surface

The MCP server exposes exactly two tiers: **atomic** (primitive driver actions) and **composite** (phase-aware orchestrations). Names are stable from v1.0 onward; schema additions are non-breaking.

All schemas are defined once in `src/schema/tools.ts` (Zod) and re-exported as the source of truth.

**Tool naming convention.** All tools are prefixed `rolepod_*` to avoid collision with other MCP servers (Microsoft Playwright MCP uses `browser_*`; Chrome DevTools MCP uses similar generic names). User-facing skills wrap these tool names so the Lead rarely sees them directly; see `11-plugin-skills.md`.

---

## Atomic tools (8)

These are escape-hatch primitives. The Lead agent uses them when composite tools don't cover the situation, typically via the wrapping skill's fallback path. Each operates on a `session_id` returned by `rolepod_browser_open`.

> All tool names below use the `rolepod_` prefix. Earlier drafts of this document omitted the prefix; that was a mistake (collision with other MCPs). The wrapping skills hide these names from end users.

### `rolepod_browser_open`

Open a new session against a target.

```ts
input: {
  platform: 'web' | 'ios' | 'android'
  // web
  url?: string
  browser?: 'chromium' | 'firefox' | 'webkit'   // default: chromium
  viewport?: { width: number; height: number }
  // ios
  bundle_id?: string
  device?: string                                // e.g. "iPhone 15"
  // android
  app_package?: string
  app_activity?: string
  emulator?: string
  // common
  headless?: boolean                             // default: false on dev, true in CI
  user_agent?: string
  locale?: string
}
output: {
  session_id: string
  platform: 'web' | 'ios' | 'android'
}
```

### `rolepod_browser_close`

Close a session and free resources.

```ts
input:  { session_id: string }
output: { closed: true }
```

### `rolepod_browser_snapshot`

Return the current accessibility tree of the session as a unified, ref-addressable structure. Every interactable node gets a stable `ref` for the duration of the snapshot.

```ts
input:  { session_id: string; mode?: 'visible' | 'full' }
output: {
  session_id: string
  url_or_screen: string                          // url for web, screen identifier for mobile
  tree: A11yNode                                 // see below
  screenshot_ref?: string                        // path to a screenshot saved with this snapshot
  taken_at: string                               // ISO8601
}

type A11yNode = {
  ref: string                                    // "e7" — stable within this snapshot
  role: string                                   // ARIA role for web, AT role for mobile
  name?: string                                  // accessible name
  value?: string
  state?: { focused?: boolean; selected?: boolean; expanded?: boolean; disabled?: boolean }
  bbox?: { x: number; y: number; w: number; h: number }
  children?: A11yNode[]
}
```

### `rolepod_browser_click`

```ts
input:  { session_id: string; ref: string; button?: 'left' | 'right' | 'middle' }
output: { clicked: true; new_snapshot?: A11yNode }
```

### `rolepod_browser_type`

```ts
input:  { session_id: string; ref: string; text: string; clear_first?: boolean }
output: { typed: true }
```

### `rolepod_browser_key`

```ts
input:  { session_id: string; key: string }     // 'Enter', 'Tab', 'Escape', 'a', etc.
output: { pressed: true }
```

### `rolepod_browser_scroll`

```ts
input: {
  session_id: string
  direction: 'up' | 'down' | 'left' | 'right'
  amount?: number                                // pixels for web, swipe distance for mobile
  ref?: string                                   // if scrolling a specific scrollable
}
output: { scrolled: true }
```

### `rolepod_browser_wait_for`

```ts
input: {
  session_id: string
  condition:
    | { kind: 'text_visible'; text: string }
    | { kind: 'ref_exists'; query: string }      // accessible name query
    | { kind: 'url_matches'; pattern: string }
    | { kind: 'idle'; ms: number }               // network + cpu idle for ms
  timeout_ms?: number                            // default 10000
}
output: { matched: true; waited_ms: number }
```

### `rolepod_browser_screenshot`

```ts
input:  { session_id: string; full_page?: boolean }
output: { path: string; width: number; height: number }
```

---

## Composite tools (6)

These bundle multiple atomic operations into a single MCP call. They exist because:

1. They save Lead token cost — one tool call replaces 5–20 atomic round-trips.
2. They produce artifacts that align with rolepod parent skills' evidence expectations.
3. Their schemas encode the *intent* of a workflow phase, not just a list of actions.

### `rolepod_verify_ui_flow`  →  shipped skill: `/verify-ui`

Drive a UI through a sequence of steps and verify expectations.

```ts
input: {
  open: {                                        // see browser_open
    platform, url?, bundle_id?, app_package?, ...
  }
  steps: Array<
    | { kind: 'click'; query: string }           // resolves against fresh snapshot
    | { kind: 'type'; query: string; text: string; clear_first?: boolean }
    | { kind: 'key'; key: string }
    | { kind: 'wait_for'; condition: WaitCondition }
    | { kind: 'navigate'; url: string }
  >
  expect: Array<
    | { kind: 'text_visible'; text: string }
    | { kind: 'text_absent'; text: string }
    | { kind: 'url_matches'; pattern: string }
    | { kind: 'ref_in_state'; query: string; state: 'visible' | 'enabled' | 'focused' }
  >
  capture?: Array<'screenshot' | 'har' | 'console' | 'a11y_tree' | 'video'>
  close_on_finish?: boolean                      // default: true
}
output: {
  run_id: string
  passed: boolean
  failed_at_step?: number
  failure_reason?: string
  evidence_paths: {
    screenshots?: string[]
    har?: string
    console?: string
    a11y_tree?: string
    video?: string
  }
  replay_bundle?: string                         // path to deterministic replay JSON
}
```

> **Note on bug reproduction:** A bug reproduction is `mode: 'reproduce'` of `rolepod_verify_ui_flow` above. The shape (drive steps → check assertions) is identical; only assertion semantic differs ("expect bug to surface") plus optional step minimization. See D-025.

### `rolepod_audit_a11y`  →  shipped skill: `/audit-a11y`

Run an accessibility audit on the current screen or page.

```ts
input: {
  open: BrowserOpen
  level: 'wcag-a' | 'wcag-aa' | 'wcag-aaa'
  scope?: 'page' | { ref: string }
  report_format?: 'json' | 'markdown'
}
output: {
  run_id: string
  issues: Array<{
    wcag_ref: string                             // e.g. "1.4.3"
    severity: 'critical' | 'serious' | 'moderate' | 'minor'
    ref: string                                  // element ref
    description: string
    fix_suggestion?: string
  }>
  report_path: string
}
```

### `rolepod_visual_diff`  →  shipped skill: `/visual-diff`

Capture a screenshot and compare against a baseline.

```ts
input: {
  open: BrowserOpen
  baseline_id: string                            // user-named, e.g. "homepage-light"
  viewport?: { width: number; height: number }
  threshold_pct?: number                         // default 0.1
}
output: {
  run_id: string
  diff_pct: number
  passed: boolean
  baseline_path: string
  current_path: string
  diff_image_path?: string
  regions?: Array<{ x: number; y: number; w: number; h: number }>
}
```

If no baseline exists, the current capture is stored as the baseline and `passed: true` with `diff_pct: 0`.

### `rolepod_scaffold_e2e`  →  shipped skill: `/scaffold-e2e`

Generate a runnable test file from a natural-language scenario.

```ts
input: {
  framework: 'playwright-test' | 'vitest+playwright' | 'pytest+selenium'
  scenario_nl: string                            // "user logs in, navigates to dashboard, sees their name"
  url: string                                    // entry point
  recorded_bundle?: string                       // optional replay bundle from a prior verify_ui_flow
}
output: {
  test_file_path: string
  language: 'typescript' | 'python'
  dependencies: string[]                         // packages to install
  setup_notes?: string
}
```

If `recorded_bundle` is supplied, the scaffolder transcribes the recorded steps; otherwise it generates a skeleton from `scenario_nl` using the calling Lead agent (the MCP returns the prompt for the Lead to fill in, rather than calling an LLM itself).

### `rolepod_extract_ui_state`  →  used internally by other shipped skills (not user-facing)

Pull a structured value out of the current screen.

```ts
input: {
  session_id?: string                            // existing session, OR
  open?: BrowserOpen                             // open one
  question_nl: string                            // "what's the order total?"
  schema?: JsonSchema                            // optional output shape
}
output: {
  value: unknown                                 // shaped to schema if provided
  evidence: {
    snapshot_ref: string
    matched_refs: string[]                       // which elements were used
  }
  confidence: 'high' | 'medium' | 'low'          // heuristic from match quality
}
```

The MCP does **not** call an LLM here. It returns the relevant AT-tree subtree and the Lead agent interprets it. (For Lead, this is far cheaper than a full snapshot and reduces the token cost of UI-state checks.)

---

## Naming conventions

- All tools are prefixed `rolepod_*` to namespace away from other MCP servers (`browser_*` is Playwright MCP).
- Within the `rolepod_*` namespace, atomic tools use `rolepod_browser_*`; composites use `rolepod_<phase-verb>_*`.
- All references between tools use the field name `ref` (single) or `refs` (list).
- All session handles use the field name `session_id`.
- All artifact outputs include a `run_id` and at least one path field ending in `_path` or `_paths`.

## Versioning policy

- Adding a new optional field to an input schema: **minor** version.
- Adding a new tool: **minor** version.
- Renaming a field or tool, removing a field, or changing semantics: **major** version.
- Schema additions to outputs: **minor** version (consumers tolerate extra keys).

## What this does *not* expose

Deliberately not included in v1:

- `execute_javascript` — too footgunny across platforms.
- `drag_and_drop` — deferred to v1.1; needs careful ref-pair semantics.
- `upload_file` — deferred; per-platform path resolution is fiddly.
- `print_to_pdf` — niche; users can use Playwright directly.
- `switch_tab` — covered implicitly by `browser_open` returning new sessions.

These may return as additional atomic tools after v1.0 stabilizes.
