# rolepod-uiproof

**rolepod-uiproof gives Claude Code, Cursor, Codex CLI, and Gemini CLI a real browser/mobile driver — so the AI can actually click through your UI, audit accessibility, check console errors, inspect network requests, diff screenshots, and scaffold e2e tests instead of guessing.**

One MCP server, one tool surface, five skills you invoke from chat. Web is production-ready via Playwright; iOS and Android use Appium (same client as alumnium — needs a local Appium daemon + simulator/emulator, or a real device). No internal LLM — your Lead agent drives every action.

**v0.5 completes the UI verification surface — replacing `chrome-devtools-mcp` and `playwright-mcp` for UI testing.** 26 tools total (21 atomic + 5 composite). New in v0.5: console + network observability, hover / drag / fill_form / upload / dialog, runtime emulation (resize / offline / geolocation / color_scheme / network + CPU throttle), multi-page support, gated JS eval, and impl of HAR / video / trace capture in `/verify-ui`.

## What it helps with

- **Verify a UI change in seconds.** `/verify-ui` opens a real browser, runs your steps, checks your assertions, saves a screenshot + replay bundle (optionally HAR + video + trace + console logs).
- **Gate merges on "no regressions during this flow".** `/check-errors` runs a flow with strict `no_console_errors` + `no_failed_requests` assertions baked in. PR-gate or post-merge smoke check.
- **Catch a11y regressions before merge.** `/audit-a11y` runs axe-core against WCAG-A / AA / AAA and returns issues grouped by severity, with WCAG references and fix links.
- **Lock down the visual contract.** `/visual-diff` captures a screenshot and compares against a named baseline under `./.rolepod-uiproof/baselines/`. First call seeds; subsequent calls diff.
- **Turn an interactive verify run into a real test file.** `/scaffold-e2e` transcribes a replay bundle into Playwright Test, Vitest+Playwright, or pytest+selenium — with first-class codegen for every step + expect kind.
- **Reproduce + minimize a bug deterministically.** `/verify-ui` with `mode: "reproduce"` runs ddmin step-elimination to find the shortest still-reproducing sequence.

## The five skills

| Skill | Wraps | What it does |
|---|---|---|
| `/verify-ui` | `rolepod_verify_ui_flow` | Drive a session through steps, evaluate assertions (incl. console errors / failed requests / specific request made / response status), save evidence (screenshot / console / HAR / video / trace / a11y_tree) + replay bundle. `mode: assert` or `reproduce` with optional ddmin minimization. |
| `/check-errors` | `rolepod_verify_ui_flow` | Thin wrapper with strict `no_console_errors` + `no_failed_requests` baked in. Use as PR-gate or post-merge smoke. |
| `/audit-a11y` | `rolepod_audit_a11y` | axe-core audit at WCAG-A / AA / AAA. `scope: "page"` or `scope: { ref }`. Markdown or JSON report. |
| `/visual-diff` | `rolepod_visual_diff` | Pixel diff against a named baseline. Auto-seeds on first call. Configurable threshold + pixelmatch sensitivity. |
| `/scaffold-e2e` | `rolepod_scaffold_e2e` | Generate a runnable test file from a scenario + optional replay bundle. Three target frameworks. v0.5 codegen handles every step + expect kind. |

Every skill is **single-backend** (D-024) — it calls the rolepod-uiproof server and only the rolepod-uiproof server. If the server is unavailable, the skill fails with a clear diagnostic. Multi-backend routing belongs in the parent [`rolepod`](https://github.com/nuttaruj/rolepod) plugin's phase skills, not here.

## Install

Pick your CLI. All install paths share the same MCP server (`@rolepod/uiproof` on npm) and the same skill set.

### Claude Code (recommended)

```bash
# Install
claude plugin marketplace add nuttaruj/rolepod-uiproof
claude plugin install rolepod-uiproof@rolepod-uiproof

# Update
claude plugin marketplace update rolepod-uiproof
claude plugin install rolepod-uiproof@rolepod-uiproof

# Uninstall
claude plugin uninstall rolepod-uiproof@rolepod-uiproof
claude plugin marketplace remove rolepod-uiproof
```

The plugin auto-registers the four `/verify-ui` / `/audit-a11y` / `/visual-diff` / `/scaffold-e2e` skills AND spawns the MCP server (`npx -y @rolepod/uiproof`) on session start.

### Cursor IDE

Cursor's plugin marketplace is enterprise-only (Free / Pro plans cannot install marketplace plugins). For everyone else, drop the workspace MCP config:

```bash
# Per project — copy from this repo, or run:
mkdir -p .cursor
curl -fsSL https://raw.githubusercontent.com/nuttaruj/rolepod-uiproof/main/.cursor/mcp.json -o .cursor/mcp.json

# Or global (across every project)
mkdir -p ~/.cursor
curl -fsSL https://raw.githubusercontent.com/nuttaruj/rolepod-uiproof/main/.cursor/mcp.json -o ~/.cursor/mcp.json
```

Then **fully restart Cursor** — MCP servers load only at startup. Verify under **Settings → MCP**.

Skills are not auto-registered under Cursor (no unified plugin format for skills + MCP in one). The MCP tools are still available; invoke them by name in chat (`Use rolepod_verify_ui_flow to …`).

> **Teams / Enterprise:** add `https://github.com/nuttaruj/rolepod-uiproof` as a team marketplace under **Settings → Plugins** for one-click install with skills auto-registered.

### Codex CLI

```bash
# Install
codex plugin marketplace add nuttaruj/rolepod-uiproof
codex plugin install rolepod-uiproof@rolepod-uiproof

# Update
codex plugin marketplace upgrade rolepod-uiproof
codex plugin install rolepod-uiproof@rolepod-uiproof
```

Codex reads the plugin from `.agents/plugins/marketplace.json` + `.codex-plugin/plugin.json` in this repo. Skills install to `~/.codex/skills/` (Codex's plugin loader handles registration).

### Gemini CLI

Not yet shipped. The Gemini extension format is not yet stable enough to commit to; we plan to add `gemini-extension.json` in v0.4. Track [issue #N](https://github.com/nuttaruj/rolepod-uiproof/issues) if you need it.

### Direct npm (any MCP-aware tool)

Use this when your tool reads a standard `mcpServers` config (most non-CLI MCP clients):

```json
{
  "mcpServers": {
    "rolepod-uiproof": {
      "command": "npx",
      "args": ["-y", "rolepod-uiproof"]
    }
  }
}
```

15 MCP tools (`rolepod_browser_*` + `rolepod_verify_ui_flow` + 4 composites) will appear in your client. Skills are not surfaced via this path — call the tools by name.

## Quick start

After install, in your Claude Code / Cursor / Codex session:

```
/verify-ui https://example.com
  steps: []
  expect: text_visible "Example Domain", text_visible "Learn more"
```

Returns a `run_id`, `passed: true`, and a path under `./.rolepod-uiproof/artifacts/verify_<run_id>/`:

```
.rolepod-uiproof/artifacts/verify_20260524T101512_a1b2c3d4/
├── final.png            screenshot at end of run
└── replay.json          replay bundle — re-runnable via `npx rolepod-uiproof replay …`
```

Convert that to a Playwright Test file:

```
/scaffold-e2e from .rolepod-uiproof/artifacts/verify_…/replay.json using playwright-test
```

## Verify your setup

```bash
npx rolepod-uiproof doctor
```

```
✓ Node ≥20                       24.14.0
✓ Playwright Chromium installed  ~/Library/Caches/ms-playwright
✓ webdriverio (mobile client, v0.3)
• Appium server (roadmap v0.3)   Not reachable at http://127.0.0.1:4723/status
✓ Xcode (iOS, roadmap v0.3)      /Applications/Xcode.app
• Android SDK (roadmap v0.3)     Set ANDROID_HOME — needed only for Android
• SeleniumEngine (roadmap v0.4)  Not implemented — deferred to v0.4
✓ Artifact root writable
```

`✓` = ready · `•` = optional / deferred · `✗` = blocker.

## What's inside

- **15 MCP tools** — 10 atomic browser/mobile primitives (`browser_open`, `_close`, `_snapshot`, `_click`, `_type`, `_key`, `_scroll`, `_wait_for`, `_screenshot`, `_navigate`) + 5 composites (`verify_ui_flow`, `audit_a11y`, `visual_diff`, `scaffold_e2e`, `extract_ui_state`). All prefixed `rolepod_*` to namespace away from other MCP servers.
- **2 engines behind one interface** — `PlaywrightEngine` for web (Chromium / Firefox / WebKit), `AppiumEngine` for iOS XCUITest + Android UIAutomator2. The Lead sees one unified `A11yNode` shape regardless of platform.
- **Stable refs with explicit invalidation (D-010)** — every state-changing call invalidates prior refs; the engine returns a structured `stale_ref` error if you try to reuse one. No silent locator drift.
- **Replay bundles** — every `/verify-ui` run writes a JSON replay you can re-run later with `npx rolepod-uiproof replay <bundle.json>`, agent-free.
- **No internal LLM (D-004)** — your Lead agent makes every decision. We don't double-bill you for inference.

## Use with parent rolepod

If you also use [`rolepod`](https://github.com/nuttaruj/rolepod) (the markdown plugin), its `check-work`, `debug-issue`, and `review-code` skills auto-route to `/verify-ui`, `/audit-a11y`, and `/visual-diff` when the rolepod-uiproof server is present. Nothing breaks if it isn't — parent falls back to Playwright MCP / Chrome DevTools MCP / manual verification.

The two are **independent**: install rolepod-uiproof standalone and get a complete experience via slash commands, or install both together and let parent's phase router pick the right backend automatically.

## Docs

- [docs/sessions.md](docs/sessions.md) — session lifecycle, stale-ref semantics, multi-session
- [docs/artifacts.md](docs/artifacts.md) — `.rolepod-uiproof/` layout, run_id convention, replay bundle format
- [docs/recipes/](docs/recipes/) — `verify-a-checkout-flow`, `audit-a11y-during-review`, `visual-baseline-workflow`
- [CHANGELOG.md](CHANGELOG.md) — release history with per-version "Not yet verified" notes mapped to milestones
- [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

---

MIT licensed — see [LICENSE](LICENSE) and [THIRD_PARTY.md](THIRD_PARTY.md). Mobile AT normalizers are alumnium-inspired ([UPSTREAM_TRACKING.md](UPSTREAM_TRACKING.md)). Feedback + runtime reports for Cursor / Codex / Gemini install paths especially welcome via [issues](https://github.com/nuttaruj/rolepod-uiproof/issues).
