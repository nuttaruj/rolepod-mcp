# rolepod-mcp

> Multi-platform UI / mobile automation for AI coding agents — shipped as
> a plugin (skills + MCP server) for Claude Code, Cursor, Codex CLI, and
> Gemini CLI.

**Status:** v0.2 (web only). iOS / Android land in v0.3 — see
[`brief/09-roadmap.md`](brief/09-roadmap.md).

rolepod-mcp is the runtime sibling of the
[`rolepod`](https://github.com/nuttaruj/rolepod) markdown plugin. The two
are distinct: rolepod ships workflow skills and agents (markdown only);
rolepod-mcp ships an MCP server plus its own user-invocable skills.

---

## What v0.2 ships

| Layer | Surface |
|---|---|
| Plugin manifest | `.claude-plugin/plugin.json` (auto-discovers skills + spawns the MCP server) |
| Shipped skills | `/verify-ui`, `/audit-a11y`, `/visual-diff`, `/scaffold-e2e` (single-backend, no fallback — D-024) |
| Composite tools (5) | `rolepod_verify_ui_flow` (mode `assert` + `reproduce` with step minimization), `rolepod_audit_a11y`, `rolepod_visual_diff`, `rolepod_scaffold_e2e`, `rolepod_extract_ui_state` (internal) |
| Atomic tools (10) | `rolepod_browser_open` / `_close` / `_snapshot` / `_click` / `_type` / `_key` / `_scroll` / `_wait_for` / `_screenshot` / `_navigate` |
| Engine | `PlaywrightEngine` (web only, Chromium default) — Firefox + WebKit selectable per session |
| Artifacts | `./.rolepod-mcp/artifacts/{run_id}/` (D-026) + `./.rolepod-mcp/baselines/` for visual diff |
| CLI entry | `bin/rolepod-mcp` (stdio MCP transport) |
| Schema export | `dist/schemas/tools.json` (`npm run build:schemas`) |

Out of scope for v0.2: mobile platforms (Appium), Selenium engine,
replay execution, SSE transport, Docker image, public docs site. See
`brief/09-roadmap.md` for the v0.3+ plan.

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
