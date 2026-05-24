# 09 — Roadmap

Milestone-based. Each milestone defines exit criteria. No date estimates; ship when the criteria are met.

---

## v0.1 — Proof of concept (PoC)

**Goal.** Prove the architecture works end-to-end on one composite tool, one engine, one platform.

**Scope.**
- Repo scaffold: `package.json`, `tsconfig.json`, `tsup` build, `vitest` setup.
- MCP server skeleton (`server.ts`) using `@modelcontextprotocol/sdk`.
- `Engine` interface defined.
- `PlaywrightEngine` — minimum viable: `open`, `close`, `snapshot`, `click`, `type`, `key`, `screenshot`.
- A11y normalize: Chromium tree → unified `A11yNode`.
- One composite tool: `verify_ui_flow` (web only, no mobile).
- Atomic tools: just enough to support the composite — `browser_open`, `browser_close`, `browser_snapshot`, `browser_click`, `browser_type`.
- ArtifactStore with screenshot + replay-bundle output.
- `bin/rolepod-mcp` stdio entry.
- Smoke test against `https://example.com` and one local fixture.

**Out of scope for v0.1.**
- Mobile (Appium, iOS, Android).
- Selenium engine.
- A11y audit, visual diff, scaffold_e2e, extract_ui_state composites.
- Replay execution (record only; replay is v0.4).
- SSE transport.
- Docker image.
- Public docs site.

**Exit criteria.**
- `npx rolepod-mcp smoke` passes locally on macOS and Ubuntu.
- One end-to-end demo with Claude Code calling `verify_ui_flow` against `https://example.com`.
- README has install + quick start.
- Repo published as a private GitHub repo for review.

**Estimated effort.** 3–5 focused sessions.

---

## v0.2 — Atomic + composite complete (web only)

**Goal.** Fill out the entire tool surface for web. Mobile still deferred.

**Scope.**
- All 8 atomic tools.
- All 6 composite tools, but only the web paths.
- `audit_a11y` — integrates `@axe-core/playwright` or equivalent.
- `visual_diff` — uses `pixelmatch` or `sharp` for image compare.
- `scaffold_e2e` — generates Playwright Test files.
- `extract_ui_state` — returns AT subtree only (no LLM, no interpretation).
- `verify_ui_flow` mode `reproduce` — minimization via deterministic step reduction.
- Stale-ref error semantics implemented + tested.
- Artifact format documented in `docs/artifacts.md`.
- Session lifecycle: idle timeout, graceful shutdown.

**Exit criteria.**
- All composites pass a smoke test on a known sample app.
- Schema export to `dist/schemas/tools.json` works.
- README covers install + each tool with example.
- Repo published publicly on GitHub.

---

## v0.3 — Mobile support

**Goal.** Add iOS and Android via Appium. Same tool surface, multi-platform.

**Scope.**
- `AppiumEngine` with XCUITest + UIAutomator2 drivers.
- A11y normalize: XCUITest tree + UIAutomator2 tree → unified `A11yNode`.
- `install:mobile` subcommand of `rolepod-mcp` CLI.
- Mobile path in `browser_open` (`platform: 'ios' | 'android'`).
- iOS + Android variants of each composite tool tested on real fixture apps.
- Doctor subcommand: detects missing Xcode / Android SDK and prints fix hints.

**Exit criteria.**
- Smoke test green for web + iOS + Android.
- A "todo app" fixture exists with web, iOS, Android variants; each composite passes against all three.
- Install:mobile flow works on a clean macOS with only Xcode installed.

---

## v0.4 — Replay + Selenium + polish

**Goal.** Determinism, legacy support, polish.

**Scope.**
- Replay execution: re-run a bundle without an agent.
- `SeleniumEngine` for legacy grid users (web only, opt-in via env).
- Performance: snapshot caching for read-only composites.
- Better error messages with diagnostic context.
- `rolepod-mcp doctor` complete.
- Initial docs site (Astro) with tool reference, recipes, mobile setup guide.
- Docker image at `ghcr.io/nuttaruj/rolepod-mcp` (web).

**Exit criteria.**
- 80%+ test coverage on tool layer and engine layer.
- Docs site live with at least 3 recipes.
- A replay bundle from v0.2 still works on v0.4 (forward compat).

---

## v0.5 — Open source launch

**Goal.** Ready for external contributors and discovery.

**Scope.**
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` complete.
- Issue + PR templates.
- CI green on macOS, Ubuntu, Windows for web; macOS for mobile.
- Logo and brand assets.
- Blog post explaining the design.
- Submitted to MCP server directory and at least one awesome-mcp list.
- Initial CHANGELOG with all v0.x entries.

**Exit criteria.**
- A third-party contributor can read the docs and submit a PR without asking for clarification (validated by having someone outside the project try).
- 100+ npm weekly downloads.

---

## v1.0 — Stable

**Goal.** Schema stability promise begins.

**Scope.**
- All v0.x tool names and required fields locked.
- Compatibility matrix verified for stated min versions.
- Replay bundle format frozen as `v1`.
- Sustainability decisions in place (sponsorship link, maintainer guide).
- v1.0 announcement post with benchmark vs Playwright MCP and alumnium (LLM-loop-cost comparison, latency, install size).

**Exit criteria.**
- 1k+ weekly npm downloads.
- 3+ external contributors with merged PRs in the v0.x cycle.
- At least one third-party project documents using rolepod-mcp.
- Zero open P0 issues.

---

## Post-v1.0 ideas (not committed)

- `drag_and_drop`, `upload_file` atomic tools (deferred from v1).
- Visual regression baseline storage backend (S3 / R2) — opt-in.
- Browser context profiles (saved logins, cookies).
- WebKit-specific automation features.
- Headed mode video recording.
- Multi-tab orchestration tool.
- A second engine for web (Chrome DevTools Protocol direct, no Playwright) — only if Playwright's release cadence becomes a blocker.
- Hosted device cloud integration (BrowserStack, Sauce Labs) — only if community demand exists.
- Voice-driven test commands — almost certainly not; out of scope.

---

## Anti-roadmap (will not do)

- **Become a testing framework.** rolepod-mcp will not own assertions, suites, fixtures, or test runners.
- **Become an AI agent.** No internal LLM, ever.
- **Add a SaaS tier with feature gating.** The OSS package gets everything; optional commercial products (if any) live in separate repos.
- **Support browser extensions or Electron.** Out of scope; users have other tools.
- **Add `execute_javascript`.** Too footgunny; the few legit uses can be added as specific atomic tools later.
- **Replace Playwright.** rolepod-mcp is a Lead-driven layer on top; Playwright stays the engine.

---

## Effort sizing summary

| Milestone | Rough effort | Why |
|---|---|---|
| v0.1 | 3–5 sessions | Smallest viable slice; lots of scaffolding cost amortized here |
| v0.2 | 5–8 sessions | Six composites, each non-trivial |
| v0.3 | 6–10 sessions | Mobile setup is fiddly; testing infra heavy |
| v0.4 | 4–6 sessions | Replay + Selenium + polish |
| v0.5 | 3–5 sessions | Docs, brand, community plumbing |
| v1.0 | 2–4 sessions | Mostly verification and announcement |

Single-session effort assumes a focused multi-hour block by one engineer using a strong AI coding agent.
