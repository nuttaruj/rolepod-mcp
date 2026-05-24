# 06 — Skill Integration (Plugin Model)

> **Revision history:**
> - 2026-05-24 v1 — original "patch parent skills" model.
> - 2026-05-24 v2 — pivot to plugin model with fallback inside shipped skills.
> - 2026-05-24 v3 — **current.** Fallback logic moved entirely to parent rolepod. Shipped skills use rolepod-mcp tools only.

## The model

rolepod-mcp ships as a **plugin** — MCP server + skills + manifest bundled. See `02-architecture.md` and `11-plugin-skills.md`.

The skills shipped inside the plugin are **single-backend**. They call rolepod-mcp tools and only rolepod-mcp tools. There is no fallback inside a shipped skill.

The parent rolepod plugin is where **multi-backend routing** lives. Its existing skills (`check-work`, `debug-issue`, `using-rolepod`) check what MCP backends are available and pick the best one — preferring rolepod-mcp, falling back to other MCPs, falling back to manual.

This separation is the heart of the design:

| Layer | Responsibility |
|---|---|
| rolepod-mcp shipped skill | Single backend. Call own MCP tool. Fail clearly if MCP unavailable. |
| rolepod parent skill | Orchestrator. Know multiple backends. Pick best. Fall back gracefully. |

## Why this separation

- **Single responsibility per skill.** rolepod-mcp skills are pure adapters. They do not need to know about Playwright MCP, Chrome DevTools MCP, or anything else. Less knowledge = less maintenance.
- **Parent value-add is explicit.** Routing across multiple backends is what the parent rolepod plugin does. That's the rolepod workflow promise.
- **Standalone user gets simplicity.** A user who installs only rolepod-mcp and not the parent gets straightforward skills — invoke `/verify-ui`, it calls the MCP, done. No mystery about which backend ran.
- **Failure modes are clean.** If the MCP server is down, `/verify-ui` fails with a clear error. It does not silently try something else and produce confusing partial results.
- **Cross-MCP coexistence still works.** Tool names are namespaced (`rolepod_*` vs `browser_*`). The user can install both; the parent picks rolepod-mcp first.

## Shipped skills — single backend, no fallback

Each skill shipped in the rolepod-mcp plugin follows this contract:

- Calls exactly one rolepod-mcp composite tool.
- Does not check for other MCP servers.
- If the underlying MCP tool errors or is unavailable, the skill returns a structured failure with a clear message — including a hint that the rolepod-mcp server may not be running.
- Does not attempt to recover by using a different backend.

This is the right behavior because the skill ships in the same package as the MCP server. If the user has the plugin installed, the server is supposed to be running. If it isn't, that's an operational problem to surface, not paper over.

```markdown
# Example: skills/verify-ui/SKILL.md (sketch)
---
name: verify-ui
description: Drive a browser or mobile session through steps and assert expectations.
---

## Process

1. Construct the input for `rolepod_verify_ui_flow` from the user's intent.
2. Call the tool.
3. Return the result to the conversation.

## If the tool is unavailable

The rolepod-mcp MCP server is not registered or not responding. Tell the user to:
- Confirm the plugin is installed: `claude plugin list | grep rolepod-mcp`
- Try restarting the CLI session.
- Run `rolepod-mcp doctor` to diagnose.

Do not attempt the work via another backend.
```

## Parent rolepod patches — where the fallback lives

The parent rolepod plugin gets three skill patches. Each one contains the multi-backend logic.

### Patch 1 — `core/skills/check-work/SKILL.md`

Append a section:

```markdown
## UI verification

If the diff touches user-visible UI, verify with a browser before claiming done. Pick the best available backend:

1. **rolepod-mcp** — if the skill `/verify-ui` is available (rolepod-mcp plugin installed), invoke it. Best path; supports web + iOS + Android.
2. **Playwright MCP** — if `browser_snapshot` is registered (Playwright MCP installed), orchestrate atomic calls: snapshot → resolve refs from steps → click/type → re-snapshot → assert each expectation. Web only.
3. **Chrome DevTools MCP** — similar atomic orchestration if its tools are registered. Web only.
4. **Manual** — describe the steps and expected outcome to the user; ask them to confirm. State explicitly that UI verification was not automated.

Skip entirely for backend-only, doc, and config diffs.
```

### Patch 2 — `core/skills/debug-issue/SKILL.md`

Append:

```markdown
## Browser reproduction

For bugs that mention visible UI behavior (click, render, hover, navigation), reproduce in a browser before writing a failing test:

1. **rolepod-mcp** — if `/verify-ui` is available, invoke it with `mode: 'reproduce'`. Returns minimal repro steps + artifacts.
2. **Playwright MCP** — orchestrate atomic to reproduce; you minimize manually.
3. **Manual** — describe the candidate repro steps to the user and ask them to try.

The failing test uses whatever minimal repro emerges.
```

### Patch 3 — `core/skills/using-rolepod/SKILL.md` (the router)

Add to skill discovery:

```markdown
## Backend awareness

Before routing UI-related work, check which MCP backends are registered:

- `rolepod-mcp` (preferred) — skills `/verify-ui`, `/audit-a11y`, `/visual-diff`, `/scaffold-e2e` will be available.
- Playwright MCP — atomic `browser_*` tools available; web only; no shipped skills.
- Chrome DevTools MCP — atomic tools available; web only; no shipped skills.

When routing to `check-work`, `debug-issue`, or other phase skills, pass along which backend is available so the phase skill picks accordingly.
```

That is the entire parent footprint. Three patches. No agent file changes.

### Why agents do not need patches

Agents (`mobile-developer.md`, `qa-tester.md`, `ui-ux-designer.md`, etc.) inherit the available skill set automatically. When an agent does its work and `/verify-ui` is available, the agent can invoke it. The phase skills above do the routing decision; the agent simply uses what's available.

## Cross-MCP coexistence

A user can have rolepod-mcp and Playwright MCP and Chrome DevTools MCP installed all at once. There is no conflict:

- Tool names are namespaced. `rolepod_*` (rolepod-mcp), `browser_*` (Playwright MCP), `puppeteer_*` (Chrome DevTools MCP). No collision.
- Parent skill picks rolepod-mcp first because the patches above prefer it.
- Shipped skills inside rolepod-mcp only see their own tools — they never touch other MCPs.

## Disabling per session

A user can opt out of MCP usage:

- `"skip rolepod-mcp"` → the Lead, reading the parent skill markdown, drops rolepod-mcp from the preference list and routes to the next available backend.
- `"skip mcp"` → the Lead drops all MCP backends and routes to manual.
- `ROLEPOD_MCP_DISABLED=1` → the rolepod-mcp server exits immediately on launch. The Lead detects `/verify-ui` as unregistered and routes to the next backend.

These behaviors are documented in the parent skill markdown — they are not enforced at runtime by any tool.

## Forcing per task

- `"verify with browser"` / `"reproduce in browser"` / `"run a11y audit"` — read by the Lead as an explicit hint to invoke the relevant skill regardless of soft-gate conditions.

## Standalone usage (no rolepod parent)

For users who do not have the rolepod parent plugin:

1. Install rolepod-mcp plugin via the CLI's plugin marketplace.
2. Skills become available: `/verify-ui` (assert/reproduce modes), `/audit-a11y`, `/visual-diff`, `/scaffold-e2e`.
3. Lead invokes skills directly when relevant.
4. No fallback logic is involved — these skills only use rolepod-mcp tools. If the MCP server has a problem, the skill says so plainly.

The plugin manifest declares the MCP server as a bundled runtime, so plugin install handles MCP registration. No separate `claude mcp add` step is needed.

## Integrated usage (with rolepod parent)

For users with both:

1. They already have the rolepod parent plugin installed.
2. They install rolepod-mcp plugin separately.
3. Parent skills (`check-work`, `debug-issue`, `using-rolepod`) read their fallback chains and prefer the new rolepod-mcp skills.
4. The user gets a unified workflow with optimal backend selection — no extra config.

## Plugin manifest summary

```json
{
  "name": "rolepod-mcp",
  "version": "0.1.0",
  "description": "Multi-platform UI/mobile automation for AI agents — over MCP.",
  "skills": [
    "skills/verify-ui",
    "skills/audit-a11y",
    "skills/visual-diff",
    "skills/scaffold-e2e"
  ],
  "mcp_servers": {
    "rolepod-mcp": {
      "command": "npx",
      "args": ["-y", "@rolepod/mcp"],
      "env": {}
    }
  }
}
```

The exact schema differs per CLI; the same intent ships under `.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/`, `.gemini-plugin/`. See `11-plugin-skills.md`.

## What does *not* happen

These ideas appeared in earlier drafts and are now rejected:

- ❌ Shipped skills contain fallback chains (moved to parent).
- ❌ Schema snapshot file in parent rolepod repo with CI sync gate.
- ❌ Patches to 16 agent files.
- ❌ Patches to skills like `simplify-code`, `implement-plan`, `finish-work` to embed tool calls.
- ❌ A `bootstrap-mcp.sh` script orchestrated by parent `bootstrap.sh`.

## Migration plan for the parent repo

When rolepod-mcp v0.1 ships:

1. Patch `check-work/SKILL.md` (UI verification fallback chain).
2. Patch `debug-issue/SKILL.md` (browser reproduction fallback chain).
3. Patch `using-rolepod/SKILL.md` (backend awareness).
4. Add one-line mentions in parent's `README.md` and `CHEATSHEET.md`.

Three patches plus two doc lines. Done.

## Validation checklist (before declaring v0.1 done)

- [ ] User can install rolepod-mcp **without** rolepod parent and use `/verify-ui` immediately — and the skill calls rolepod-mcp directly with no fallback logic.
- [ ] User with both rolepod parent and rolepod-mcp installed gets unified workflow — parent's `check-work` skill detects `/verify-ui` and invokes it.
- [ ] User with both rolepod parent and Playwright MCP (no rolepod-mcp) — parent's `check-work` skill falls back to atomic `browser_*` orchestration.
- [ ] User with rolepod parent and no MCP at all — parent's `check-work` falls back to manual.
- [ ] Removing rolepod-mcp does not break the parent rolepod plugin.
- [ ] No tool name in rolepod-mcp collides with names exposed by Playwright MCP or Chrome DevTools MCP.
- [ ] A shipped skill, when the MCP server is unreachable, fails with a clear "MCP server unavailable" message — and does NOT silently try another backend.
