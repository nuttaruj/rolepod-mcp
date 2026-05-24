# Changelog

All notable changes to this project are recorded here. Versions follow
[Semantic Versioning](https://semver.org/). The schema-stability promise
begins at **v1.0**; until then, breaking changes are possible at any
release per `brief/03-tool-surface.md → Versioning policy`.

## [Unreleased]

## [0.2.0] — 2026-05-24

Web surface complete. Mobile still deferred to v0.3.

### Added

- **Atomic tools (5 new, 10 total):** `rolepod_browser_key`,
  `rolepod_browser_scroll`, `rolepod_browser_wait_for`,
  `rolepod_browser_screenshot`, `rolepod_browser_navigate`.
- **Composite tools (4 new, 5 total):** `rolepod_audit_a11y` (via
  `@axe-core/playwright`), `rolepod_visual_diff` (via `pixelmatch` +
  `pngjs`), `rolepod_scaffold_e2e` (playwright-test / vitest+playwright
  / pytest+selenium codegen), `rolepod_extract_ui_state` (internal
  helper — no LLM).
- **`verify_ui_flow` mode='reproduce'** with linear-pass step
  minimization (D-025).
- **3 new shipped skills:** `/audit-a11y`, `/visual-diff`,
  `/scaffold-e2e`. All single-backend with no fallback (D-024).
- **Schema export:** `npm run build:schemas` emits
  `dist/schemas/tools.json` (JSON-Schema 2019-09) for every
  `rolepod_*` tool.
- **Skill lint:** `tests/lint/skills.test.ts` enforces frontmatter,
  required body sections, single-backend tool reference, and absence of
  fallback markers.

### Changed

- `ArtifactStore` now also writes report files (`.json`/`.md`) and raw
  bytes, and exposes `baselineDir` for `visual_diff`.
- `PlaywrightEngine` exposes `getPageForSession()` as an escape hatch
  for web-only composites that need raw Page APIs.
- `SessionRegistry.open` throws `unsupported_platform` (was
  `unknown_session`) when no engine is registered for the requested
  platform.

### Notes

- `mode='reproduce'` evaluates `expect` exactly the same way as
  `mode='assert'` — the user phrases assertions in terms of the bug
  surfacing. Minimization is a naive linear pass; ddmin is deferred to
  v0.3.
- `audit_a11y` currently supports `scope: 'page'` only;
  `scope: { ref }` is scheduled for v0.3 (returns
  `not_implemented_in_v02`).
- `extract_ui_state` returns the AT subtree and matched refs; the Lead
  interprets the answer. No LLM is invoked inside the MCP server
  (D-004).
- The `alumnium` driver fork (D-005) is still **not** in this release.
  Web continues to rely on Playwright's built-in `ariaSnapshot({mode:
  'ai'})` + `aria-ref` locator. The fork lands with mobile in v0.3.

## [0.1.0] — 2026-05-24

Proof of concept. Single composite, single engine, single platform.

### Added

- Plugin manifest for Claude Code (`.claude-plugin/plugin.json`) with
  `mcpServers` declaration (verified against
  [docs](https://code.claude.com/docs/en/plugins-reference)).
- MCP server skeleton via `@modelcontextprotocol/sdk@1.29.0` with
  stdio transport.
- `Engine` interface (`src/engine/Engine.ts`) and `PlaywrightEngine`
  implementation (web only).
- A11y normalization via Playwright 1.60's
  `page.ariaSnapshot({mode:'ai'})` + `aria-ref=eN` locator. (Note:
  Playwright 1.60 removed `page.accessibility`, hence the migration.)
- 5 atomic MCP tools: `rolepod_browser_open` / `_close` / `_snapshot`
  / `_click` / `_type`.
- 1 composite tool: `rolepod_verify_ui_flow` (mode='assert' only;
  mode='reproduce' deferred to v0.2 per D-025).
- 1 shipped skill: `/verify-ui` (single-backend, no fallback per
  D-024).
- `ArtifactStore` writing under `./.rolepod-mcp/artifacts/{run_id}/`
  per D-026 (renamed from `./.rolepod/`).
- `SessionRegistry` with per-platform engine routing and idle-timeout
  cleanup.
- `bin/rolepod-mcp` stdio entry; `npx rolepod-mcp` launches the
  server.
- Vitest smoke suite (`tests/smoke/example_com.test.ts`) — 6 tests
  against `https://example.com`.
- Manual MCP handshake smoke (`tests/smoke/mcp_handshake.mjs`).
- MIT license; `THIRD_PARTY.md` notes the future alumnium fork plan
  and runtime dependency licenses.

### Known limitations

- Web only. Mobile (iOS / Android via Appium) lands in v0.3.
- `mode='reproduce'` not implemented (handler returns
  `not_implemented_in_v01`).
- No alumnium driver fork yet — see v0.2 notes above.
