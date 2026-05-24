# rolepod-mcp

> Multi-platform UI / mobile automation for AI coding agents — shipped as
> a plugin (skills + MCP server) for Claude Code, Cursor, Codex CLI, and
> Gemini CLI.

**Status:** v0.3 — web is production-ready (Playwright); mobile
(iOS/Android via Appium) is scaffolded and unit-tested but requires
local infra (Xcode + Android SDK + appium daemon) for full runs. Run
`npx rolepod-mcp doctor` to see what's missing. See
[`brief/09-roadmap.md`](brief/09-roadmap.md).

rolepod-mcp is the runtime sibling of the
[`rolepod`](https://github.com/nuttaruj/rolepod) markdown plugin. The two
are distinct: rolepod ships workflow skills and agents (markdown only);
rolepod-mcp ships an MCP server plus its own user-invocable skills.

---

## What v0.3 ships

| Layer | Surface |
|---|---|
| Plugin manifest | `.claude-plugin/plugin.json` (auto-discovers skills + spawns the MCP server) |
| Shipped skills | `/verify-ui`, `/audit-a11y`, `/visual-diff`, `/scaffold-e2e` (single-backend, no fallback — D-024) |
| Composite tools (5) | `rolepod_verify_ui_flow` (mode `assert` + `reproduce` with step minimization), `rolepod_audit_a11y`, `rolepod_visual_diff`, `rolepod_scaffold_e2e`, `rolepod_extract_ui_state` (internal) |
| Atomic tools (10) | `rolepod_browser_open` / `_close` / `_snapshot` / `_click` / `_type` / `_key` / `_scroll` / `_wait_for` / `_screenshot` / `_navigate` |
| Engine | `PlaywrightEngine` (web — Chromium default, Firefox + WebKit per session) + `AppiumEngine` (iOS XCUITest / Android UIAutomator2) |
| CLI subcommands | `serve` (default), `doctor`, `install:mobile`, `replay <bundle.json>`, `--version`, `--help` |
| Artifacts | `./.rolepod-mcp/artifacts/{run_id}/` (D-026) + `./.rolepod-mcp/baselines/` for visual diff |
| CLI entry | `bin/rolepod-mcp` (stdio MCP transport) |
| Schema export | `dist/schemas/tools.json` (`npm run build:schemas`) |

Out of scope for v0.3 (still deferred): SeleniumEngine (v0.4 — needs
a Selenium grid to verify), Docker image, public docs site
(`docs/` ships markdown only; no Astro build).

---

## Install (local development)

```bash
git clone <repo-url> rolepod-mcp
cd rolepod-mcp
npm install
npx playwright install chromium
npm run build
```

Test (vitest smoke + lint, 32 tests):

```bash
npm test
```

Manual MCP-protocol smoke (spawns the stdio server, lists every tool):

```bash
npm run smoke:mcp
```

---

## Use as a Claude Code plugin

The plugin manifest declares the MCP server entry — Claude Code spawns
it on plugin load:

```json
"mcpServers": {
  "rolepod-mcp": {
    "command": "npx",
    "args": ["-y", "@rolepod/mcp"]
  }
}
```

For local development before the first npm publish, override the manifest
to point at the locally-built binary:

```json
"mcpServers": {
  "rolepod-mcp": {
    "command": "node",
    "args": ["<absolute-path>/dist/bin/rolepod-mcp.js"]
  }
}
```

Skills under `skills/` are auto-discovered by Claude Code's plugin loader
([reference](https://code.claude.com/docs/en/plugins-reference)) — no
explicit `skills:` array is needed in `plugin.json`.

### Cursor

Drop `.cursor/mcp.json` (shipped in this repo) into your project, or
copy it to `~/.cursor/mcp.json` for the user-level install. Cursor's
MCP config schema is documented at
[cursor.com/docs/mcp](https://cursor.com/docs/mcp). Then fully restart
Cursor — MCP servers load only at startup.

Cursor does not yet have a unified plugin format that bundles skills,
so the four `/verify-ui` / `/audit-a11y` / `/visual-diff` /
`/scaffold-e2e` skills are not auto-installed under Cursor. They are
available as plain markdown under `skills/` for manual reference.

### Codex CLI

`.codex-plugin/plugin.json` follows the Codex CLI plugin convention
(`skills`, `hooks`, `mcp_servers`, plus an `interface` block). Install
via the Codex plugin loader; see Codex docs for the latest path.

### Gemini CLI

Not yet shipped. Brief `11-plugin-skills.md` defers the Gemini manifest
until the official Gemini CLI plugin schema is verified.

---

## Schema export

After `npm run build`, `dist/schemas/tools.json` contains the
JSON-Schema 2019-09 definition for every `rolepod_*` tool. Consumers can
import this directly (e.g. for type generation, agent prompts, or
documentation).

---

## License

MIT — see [`LICENSE`](LICENSE).

Third-party attributions in [`THIRD_PARTY.md`](THIRD_PARTY.md), including
the future alumnium driver fork (D-005), `@axe-core/playwright`
(MPL-2.0), and the visual-diff stack (`pixelmatch` ISC + `pngjs` MIT).

---

## Design brief + changelog

- Architectural decisions: [`brief/`](brief/) — start at
  [`brief/00-INDEX.md`](brief/00-INDEX.md).
- Release history: [`CHANGELOG.md`](CHANGELOG.md).
