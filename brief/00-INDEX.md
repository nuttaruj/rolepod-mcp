# rolepod-mcp — Brief Index

> **Status:** Pre-implementation spec. No code yet.
> **Created:** 2026-05-24
> **Source session:** Design discussion in `/Users/nuttaruj/Project/rolepod` Claude Code session
> **Next phase:** Scaffold repo in new session at this working directory.

---

## What this folder is

This is the design brief for **rolepod-mcp** — a forthcoming MCP (Model Context Protocol) server that ships UI/mobile/native automation tooling to AI coding agents (Claude Code, Codex CLI, Gemini CLI, Cursor). It is the runtime sibling of the [rolepod](https://github.com/nuttaruj/rolepod) markdown plugin.

Every decision made in the source design session is recorded here so that a future session — possibly with no shared chat context — can pick up cleanly.

---

## Read order

1. **[01-vision.md](01-vision.md)** — What rolepod-mcp is, what it isn't, who it's for.
2. **[02-architecture.md](02-architecture.md)** — Plugin distribution, layer model, engine abstraction, tech stack.
3. **[03-tool-surface.md](03-tool-surface.md)** — Atomic + composite MCP tools (`rolepod_*` prefix).
4. **[04-engine-layer.md](04-engine-layer.md)** — Fork strategy from alumnium, driver matrix, license.
5. **[05-open-source.md](05-open-source.md)** — Positioning, differentiation, license, governance.
6. **[06-skill-integration.md](06-skill-integration.md)** — Plugin model — shipped skills + parent rolepod patches.
7. **[07-install-ux.md](07-install-ux.md)** — Plugin marketplace install + npm fallback + CI usage.
8. **[08-decisions.md](08-decisions.md)** — Decision log (23 decisions) with rejected alternatives and rationale.
9. **[09-roadmap.md](09-roadmap.md)** — Milestone plan v0.1 → v1.0.
10. **[10-risks.md](10-risks.md)** — Risk register and mitigations.
11. **[11-plugin-skills.md](11-plugin-skills.md)** — Plugin layout, shipped skills, manifest, fallback chain.

---

## TL;DR for next session

- **Distribution:** rolepod-mcp is a **plugin** (skills + MCP server bundled), not a bare MCP server. Plugin marketplace install is the primary path; npm-only install is a fallback for tooling without plugin support.
- **Repo type:** Separate from `rolepod`. TypeScript. npm-published. GitHub-hosted plugin.
- **Engine:** Fork the driver layer from alumnium-hq/alumnium (MIT). Drop their LLM agent layer.
- **Tool surface:** 13 MCP tools — 8 atomic + 5 composite. All prefixed `rolepod_*` to avoid collision.
- **Shipped skills (4):** `/verify-ui` (assert + reproduce modes), `/audit-a11y`, `/visual-diff`, `/scaffold-e2e`. Each wraps **one** rolepod-mcp composite tool. Single-backend. **No fallback inside shipped skills.**
- **Artifact namespace:** `./.rolepod-mcp/artifacts/{run_id}/` — distinct from rolepod parent's `~/.rolepod/` (no collision).
- **Fallback lives in parent rolepod:** Parent's `check-work`, `debug-issue`, `using-rolepod` skills implement the multi-backend chain — rolepod-mcp first, then Playwright MCP / Chrome DevTools MCP, then manual.
- **No internal LLM.** Lead agent (Claude/Codex/Gemini/Cursor) drives every action.
- **Multi-platform:** Web (Playwright) + iOS (Appium/XCUITest) + Android (Appium/UIAutomator2). One install, one tool surface.
- **License:** MIT. Attribution to alumnium in `THIRD_PARTY.md`.
- **Parent rolepod integration:** Three short patches — `check-work`, `debug-issue`, `using-rolepod`. No agent file changes. No schema sync gate.
- **Standalone use is first-class.** A user can install rolepod-mcp without rolepod parent and get full functionality via slash commands.

---

## Where to start coding (next session)

```bash
cd /Users/nuttaruj/Project/rolepod-mcp
git init
npm init -y
# follow 02-architecture.md for src/ structure
# follow 09-roadmap.md for milestone order — start with v0.1 PoC
```

First task: `verify_ui_flow` composite tool with Playwright engine. See **09-roadmap.md → v0.1**.

---

## Cross-repo handoff

The parent `rolepod` repo (`/Users/nuttaruj/Project/rolepod`) will eventually patch these skills to soft-reference rolepod-mcp tools:

- `core/skills/check-work/SKILL.md` — UI verification branch
- `core/skills/debug-issue/SKILL.md` — Browser reproduction branch
- `core/skills/review-code/SKILL.md` — A11y + visual diff branches
- `core/agents/qa-tester.md` — E2E scaffold section
- `core/agents/ui-ux-designer.md` — Live a11y audit section

These patches happen **after** rolepod-mcp v0.1 ships. See **06-skill-integration.md** for the patch contract.
