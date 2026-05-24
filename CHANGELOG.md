# Changelog

All notable changes to this project are recorded here. Versions follow
[Semantic Versioning](https://semver.org/). The schema-stability promise
begins at **v1.0**; until then, breaking changes are possible at any
release per `brief/03-tool-surface.md → Versioning policy`.

## [Unreleased]

## [0.3.0] — 2026-05-24

Mobile scaffolding + CLI + governance. Web surface unchanged. Mobile
code paths compile and the AT normalizers are unit-tested against
fixture XML; real iOS/Android runs require a local Appium server +
simulator and are gated by `npx rolepod-mcp doctor`.

### Added

- **AppiumEngine** (`src/engine/AppiumEngine.ts`) — full `Engine`
  interface implementation backed by webdriverio + Appium 2.x.
  Routes `platform: 'ios'` to XCUITest, `platform: 'android'` to
  UIAutomator2. webdriverio is lazy-loaded as an
  `optionalDependency`, so web-only installs skip it.
- **Mobile AT normalizers** (`src/engine/a11y/xcuitest.ts`,
  `uiautomator2.ts`) — inspired by alumnium (MIT) per D-005 and
  `UPSTREAM_TRACKING.md`. Original implementations using
  `fast-xml-parser`. Unit tests pass against fixture XML.
- **`audit_a11y` scope={ref}** — tags the resolved element with a
  temporary `data-rolepod-axe-scope` attribute so axe-core can
  include it. Cleans up the tag in `finally`.
- **`rolepod-mcp doctor`** — health check covering Node version,
  Playwright Chromium install, webdriverio availability, Appium
  server reachability, Xcode (macOS), Android SDK, artifact dir.
- **`rolepod-mcp install:mobile`** — prints the iOS + Android setup
  checklist with environment overrides.
- **`rolepod-mcp replay <bundle.json>`** — re-runs a verify_ui_flow
  replay bundle deterministically without an agent in the loop.
  Exit code reflects pass/fail. Brings the v0.4 replay-execution
  feature forward.
- **`ddmin` minimization** (`src/replay/minimize.ts`) — classic
  Zeller-Hildebrandt delta debugging. Replaces the v0.2 linear pass
  inside `verify_ui_flow` reproduce mode.
- **Per-CLI manifests** — `.cursor/mcp.json` (verified against
  [cursor.com/docs/mcp](https://cursor.com/docs/mcp)) and
  `.codex-plugin/plugin.json` (matches parent `rolepod`'s pattern).
  Gemini deferred until the official schema is published.
- **Governance documents** — `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`
  (Contributor Covenant 2.1, fetched canonically from
  EthicalSource), `SECURITY.md` (responsible disclosure via GitHub
  Security Advisories).
- **`.github/` templates** — bug + feature issue forms (verified
  against the GitHub Issue Forms schema), PR template, CI workflow
  for Node 20/22 × ubuntu/macos/windows running typecheck + tests +
  build + smoke handshake.
- **Public docs** — `docs/sessions.md`, `docs/artifacts.md`, plus
  three recipes in `docs/recipes/`.
- **`UPSTREAM_TRACKING.md`** — records the alumnium commit SHA
  referenced (`94dea1e69…`), the inspired-by vs. literal-fork
  decision, and the quarterly cherry-pick policy.

### Changed

- `SessionRegistry` now tracks `platform` per `session_id`
  authoritatively via `platformOf(sessionId)`. Atomic tools and
  composites consult it instead of hardcoding `'web'`.
- `bin/rolepod-mcp` dispatches subcommands (`serve` default,
  `doctor`, `install:mobile`, `replay`, `--version`, `--help`).
- `factory.ts` splits `createWebEngine` + `createMobileEngine`;
  `createEngine` is kept as a back-compat alias for v0.1 callers.

### Not yet verified — mapped to later milestones

- **Real iOS / Android device runs** — gated by local infra
  (Xcode + Android SDK + Appium daemon). `npx rolepod-mcp doctor`
  reports readiness. Code paths compile and AT normalizers are
  tested against fixture XML only; full simulator smoke arrives
  when the infra is present. Scope: still **v0.3** (mobile).
- **SeleniumEngine** — deferred to **v0.4** (legacy Selenium grid
  support, opt-in via `ROLEPOD_MCP_WEB_ENGINE=selenium`). Not
  implemented because verifying it needs a running grid we don't
  have access to in this session.
- **Replay execution beyond what v0.4 specifies** — recording +
  ddmin minimization shipped in v0.3 (the `rolepod-mcp replay`
  CLI re-runs a bundle without an agent in the loop). Full
  replay-determinism guarantees, schema freeze of the bundle
  format, and forward-compat across versions are still **v0.4**
  scope.
- **Docs site, blog post, MCP server directory submission, npm
  publish, GitHub publish** — these are **v0.5** open-source
  launch tasks. They require user action (account ownership,
  registration, narrative writing) and are not in-session
  deliverables.
- **Adoption metrics** (1k weekly downloads, 3+ external
  contributors, third-party integration documented) — **v1.0**
  exit criteria. Time and market dependent; cannot be produced
  inside an implementation session.

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
