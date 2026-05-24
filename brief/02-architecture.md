# 02 — Architecture

## Distribution model — Plugin (not bare MCP)

rolepod-mcp ships as a **plugin** — bundling skills + MCP server + manifest into one distributable unit. See `06-skill-integration.md` and `11-plugin-skills.md` for the plugin layer. The architecture below describes the runtime; the plugin layer is what loads it.

```
PLUGIN (rolepod-mcp)
├── skills/        (markdown, 4 user-invocable skills)
├── src/           (MCP server runtime — described below)
└── .{cli}-plugin/ (manifest per CLI)
```

The Lead invokes a **skill** (e.g. `/verify-ui`); the skill markdown directs the Lead to call an MCP tool; the MCP server below handles the call.

## Layer model

```
┌────────────────────────────────────────────────────────────┐
│  Lead agent (Claude Code, Codex, Gemini, Cursor)           │
│  - invokes a skill (e.g. /verify-ui)                       │
│  - skill markdown directs the Lead to call MCP tool        │
│  - falls back to other MCPs or manual per skill spec       │
└──────────────────────┬─────────────────────────────────────┘
                       │  MCP protocol (stdio or SSE)
┌──────────────────────▼─────────────────────────────────────┐
│  rolepod-mcp server (src/server.ts)                        │
│  - MCP transport, tool registration, schema validation     │
└──────────────────────┬─────────────────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────────────────┐
│  Tool layer                                                │
│  ┌──────────────┐  ┌─────────────────────────────────┐    │
│  │ atomic/      │  │ composite/                       │    │
│  │ 8 tools      │  │ 5 tools — phase-aware            │    │
│  │ ref-based    │  │ orchestrate multiple atomic ops  │    │
│  └──────┬───────┘  └─────────────┬────────────────────┘    │
└─────────┼─────────────────────────┼────────────────────────┘
          │                         │
┌─────────▼─────────────────────────▼────────────────────────┐
│  Engine layer  (src/engine/)                               │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Engine interface (src/engine/Engine.ts)            │   │
│  │   open, snapshot, click, type, key, scroll, ...    │   │
│  └──────────┬──────────────┬───────────────┬──────────┘   │
│             │              │               │              │
│    ┌────────▼──────┐ ┌─────▼──────┐ ┌─────▼──────────┐   │
│    │PlaywrightEng. │ │AppiumEng.  │ │SeleniumEng.    │   │
│    │  web          │ │  ios+andr  │ │  legacy grid   │   │
│    └────────┬──────┘ └─────┬──────┘ └────────┬───────┘   │
└─────────────┼──────────────┼─────────────────┼───────────┘
              │              │                 │
┌─────────────▼──────────────▼─────────────────▼───────────┐
│  Platform                                                 │
│  Chromium/FF/WebKit  iOS/Android (XCUITest/UIAutomator2)  │
└───────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Cross-cutting                                             │
│  ArtifactStore — ./.rolepod-mcp/artifacts/{run_id}/            │
│  ReplayBundle  — record + deterministic replay             │
│  SessionRegistry — open session lookup, idle cleanup       │
└────────────────────────────────────────────────────────────┘
```

## Why this layering

- **Tool layer split (atomic vs composite)** lets Lead use either granularity. Atomic is the escape hatch; composite is the daily-use API and where rolepod's phase value lives.
- **Engine interface** is the seam that makes Playwright replaceable. If Chromium DevTools MCP eventually beats Playwright for our use case, we add `ChromeDevtoolsEngine.ts` without touching tool code.
- **AT tree unified format** lets `browser_click(ref)` mean the same thing on web and mobile. The agent sees one schema.
- **Cross-cutting concerns are explicit modules**, not sprinkled through tools. ArtifactStore owns paths, ReplayBundle owns determinism, SessionRegistry owns lifecycle.

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript (Node ≥20) | MCP SDK first-class TS support. Playwright TS API is the canonical one. |
| MCP SDK | `@modelcontextprotocol/sdk` | Official. |
| Web driver | `playwright` | Bundled. Multi-browser. Mature. |
| Mobile driver | `webdriverio` + `appium` | Standard Appium TS client. |
| Selenium (legacy) | `selenium-webdriver` | Optional, for users on Selenium grid. |
| Schema validation | `zod` | Compose tool schemas + runtime validation. |
| Test framework | `vitest` | Fast. ESM-native. |
| Lint/format | `oxlint` + `prettier` | Matches alumnium's choice; low-friction. |
| Build | `tsup` | Single command bundle for both stdio binary and lib. |
| Release | `changesets` | Multi-package-aware if we later add `@rolepod/skills`. |
| CI | GitHub Actions | Matrix: node 20/22 × OS macos/ubuntu/windows. iOS only on macos. |
| Docs site | Astro or Docusaurus | Decide at v0.5 — premature now. |

## Dependency graph (intent)

```
@modelcontextprotocol/sdk  ──► server.ts
playwright                  ──► engine/PlaywrightEngine.ts
webdriverio + appium        ──► engine/AppiumEngine.ts
selenium-webdriver          ──► engine/SeleniumEngine.ts (optional)
zod                         ──► tools/*.ts, engine/Engine.ts
sharp                       ──► artifact/screenshot.ts (image diff)
chalk + debug               ──► logging
```

Optional dependencies pattern: `appium`, `selenium-webdriver` declared as `optionalDependencies` in `package.json` so a web-only install stays lean.

## Source layout

```
rolepod-mcp/
├── brief/                          # this folder
├── .claude-plugin/
│   └── plugin.json                 # plugin manifest (Claude Code)
├── .cursor-plugin/
│   └── plugin.json                 # plugin manifest (Cursor)
├── .codex-plugin/                  # plugin manifest (Codex)
├── .gemini-plugin/                 # plugin manifest (Gemini)
├── skills/                         # user-invocable skills (markdown)
│   ├── verify-ui/SKILL.md          # assert + reproduce modes
│   ├── audit-a11y/SKILL.md
│   ├── visual-diff/SKILL.md
│   └── scaffold-e2e/SKILL.md
├── src/
│   ├── server.ts                   # MCP entry point
│   ├── tools/
│   │   ├── atomic/
│   │   │   ├── browser_open.ts
│   │   │   ├── browser_close.ts
│   │   │   ├── browser_snapshot.ts
│   │   │   ├── browser_click.ts
│   │   │   ├── browser_type.ts
│   │   │   ├── browser_key.ts
│   │   │   ├── browser_scroll.ts
│   │   │   ├── browser_wait_for.ts
│   │   │   └── browser_screenshot.ts
│   │   └── composite/
│   │       ├── verify_ui_flow.ts    # mode: assert | reproduce
│   │       ├── audit_a11y.ts
│   │       ├── visual_diff.ts
│   │       ├── scaffold_e2e.ts
│   │       └── extract_ui_state.ts
│   ├── engine/
│   │   ├── Engine.ts               # interface
│   │   ├── PlaywrightEngine.ts
│   │   ├── AppiumEngine.ts
│   │   ├── SeleniumEngine.ts
│   │   ├── a11y/
│   │   │   ├── normalize.ts        # unified AT tree shape
│   │   │   ├── chromium.ts         # forked from alumnium
│   │   │   ├── xcuitest.ts         # forked from alumnium
│   │   │   └── uiautomator2.ts     # forked from alumnium
│   │   └── primitives/
│   │       ├── click.ts            # ref → driver call
│   │       ├── type.ts
│   │       └── ...
│   ├── artifact/
│   │   ├── ArtifactStore.ts
│   │   ├── paths.ts                # run_id, slot conventions
│   │   └── formats.ts              # screenshot, har, console, a11y.json
│   ├── replay/
│   │   ├── ReplayBundle.ts         # serialize + replay
│   │   └── recorder.ts
│   ├── session/
│   │   ├── SessionRegistry.ts
│   │   └── lifecycle.ts            # idle timeout, cleanup
│   ├── schema/
│   │   └── tools.ts                # zod schemas, single source of truth
│   └── util/
│       ├── log.ts
│       └── errors.ts
├── tests/
│   ├── smoke/                      # against a known test app
│   ├── unit/
│   └── fixtures/
├── bin/
│   └── rolepod-mcp                 # CLI entry (npx target)
├── docs/                           # public-facing, populated v0.5+
├── .github/workflows/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── README.md
├── LICENSE                         # MIT
├── THIRD_PARTY.md                  # alumnium attribution
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
└── CHANGELOG.md
```

## Process model

- Single Node process per MCP server invocation.
- Each open browser/mobile session is tracked by a `session_id` (UUID).
- Sessions auto-close after a configurable idle timeout (default: 5 min).
- The server exits cleanly when the MCP transport closes.

## Concurrency model

- Multiple sessions can coexist in one server process (the agent may open browser A and Android emulator B in parallel).
- Tools are async; the server multiplexes calls.
- Per-session operations are serialized internally (you cannot fire two clicks on the same session simultaneously).

## State and persistence

- **In-memory:** session registry, ref index for the current snapshot of each session.
- **On-disk:** artifacts (`./.rolepod-mcp/artifacts/{run_id}/`), replay bundles, cached snapshots if `--cache` flag is set.
- **No database.** Filesystem only.

## Security model

- The MCP server runs locally as the user. It can do anything the user's browser can.
- No network exposure by default (stdio transport).
- SSE transport is opt-in (`--transport sse --port 9876`) and binds to localhost.
- No telemetry. No phone-home. (See `05-open-source.md` for the no-telemetry commitment.)
