# rolepod-mcp

> Multi-platform UI / mobile automation for AI coding agents — shipped as a
> plugin (skills + MCP server) for Claude Code, Cursor, Codex CLI, and
> Gemini CLI.

**Status:** v0.1 proof-of-concept. Web only (Playwright). iOS / Android land
in v0.3. See [`brief/09-roadmap.md`](brief/09-roadmap.md).

rolepod-mcp is the runtime sibling of the
[`rolepod`](https://github.com/nuttaruj/rolepod) markdown plugin. The two are
distinct: rolepod ships workflow skills and agents (markdown only);
rolepod-mcp ships an MCP server plus its own user-invocable skills.

---

## What v0.1 ships

| Layer | Surface |
|---|---|
| Plugin manifest | `.claude-plugin/plugin.json` (Claude Code only in v0.1) |
| Shipped skill | `/verify-ui` (single-backend, no fallback) |
| Composite tool | `rolepod_verify_ui_flow` (mode `assert` — `reproduce` lands in v0.2) |
| Atomic tools | `rolepod_browser_open`, `_close`, `_snapshot`, `_click`, `_type` |
| Engine | `PlaywrightEngine` (web only, Chromium default) |
| Artifacts | `./.rolepod-mcp/artifacts/{run_id}/` |
| CLI entry | `bin/rolepod-mcp` (stdio MCP transport) |

Out of scope for v0.1: mobile platforms, Selenium engine, replay execution,
a11y / visual-diff / scaffold-e2e composites, SSE transport, Docker image,
public docs site. See `brief/09-roadmap.md`.

---

## Install (local development, v0.1)

```bash
git clone <repo-url> rolepod-mcp
cd rolepod-mcp
npm install
npx playwright install chromium
npm run build
```

Smoke test against `https://example.com`:

```bash
npm run test:smoke
```

---

## Use as a Claude Code plugin (local dev)

Point Claude Code at this directory and the plugin manifest will register
the `/verify-ui` skill plus the `rolepod-mcp` MCP server.

The MCP server is launched via the published CLI binary in the manifest:

```json
"mcp_servers": {
  "rolepod-mcp": {
    "command": "npx",
    "args": ["-y", "@rolepod/mcp"]
  }
}
```

For local development before the first npm publish, the manifest can be
overridden to point at the locally-built binary:

```json
"mcp_servers": {
  "rolepod-mcp": {
    "command": "node",
    "args": ["<absolute-path>/dist/bin/rolepod-mcp.js"]
  }
}
```

---

## License

MIT — see [`LICENSE`](LICENSE).

Third-party attributions in [`THIRD_PARTY.md`](THIRD_PARTY.md).

---

## Design brief

Every architectural decision is recorded in [`brief/`](brief/). Start with
[`brief/00-INDEX.md`](brief/00-INDEX.md).
