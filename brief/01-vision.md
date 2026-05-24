# 01 — Vision

## One-sentence pitch

**rolepod-mcp** gives AI coding agents a single MCP server that drives web, iOS, and Android UIs with atomic primitives and phase-aware composite operations — no vendor LLM, no per-platform setup, no glue code.

## What it is

A standalone Model Context Protocol server (TypeScript, Node ≥20) that exposes ~14 tools an MCP-capable agent can call to:

- Open and control a real browser session (Chromium, Firefox, WebKit via Playwright).
- Open and control a real mobile session (iOS Simulator / real device via Appium XCUITest, Android Emulator / real device via Appium UIAutomator2).
- Snapshot the accessibility tree of any session as a unified, ref-addressable JSON structure.
- Perform atomic actions (click, type, scroll, navigate, key press, wait) on any platform through one ref-based API.
- Execute composite, phase-aware operations (verify a UI flow, reproduce a bug, audit accessibility, capture a visual diff, scaffold an e2e test, extract structured state from UI) that return artifacts ready for the parent rolepod workflow.

The server is **passive**: it never calls an LLM internally. Every decision — what to click, what to assert, what to extract — is made by the calling agent (Lead or sub-agent).

## What it is not

- **Not a testing framework.** It does not own assertions, suites, fixtures, or test discovery. Pytest, Vitest, Playwright Test, etc. remain unchanged.
- **Not an AI agent.** It executes; it does not decide.
- **Not opinionated about test format.** The `scaffold_e2e` composite tool generates code for any of Playwright Test, Vitest+Playwright, or Pytest+Selenium — output, not framework.
- **Not a standalone library.** It is consumed exclusively over MCP. There is no Python/TS SDK to import. (If users want that, they should use alumnium or Playwright directly.)
- **Not bound to OpenAI, Anthropic, or any other LLM provider.** There is no `OPENAI_API_KEY` or equivalent. Bring your own agent.
- **Not a Selenium replacement.** Selenium support is provided for legacy grids only and is not the primary engine.

## Target users

### Persona 1 — rolepod power user
Already runs Claude Code / Codex / Cursor with the rolepod plugin. Writes web apps. Wants the `check-work` skill to actually verify UI changes against a running dev server, not just promise to. Installs once; everything else is automatic.

### Persona 2 — mobile dev with an AI coding agent
Builds an iOS or Android app. Wants the same Claude / Codex session that wrote the screen to also tap through it. Installs the optional mobile driver pack; uses the same tool names as web.

### Persona 3 — open-source contributor / integrator
Builds their own agent or framework on MCP. Wants a reliable, vendor-neutral, multi-platform browser/UI primitive set without reinventing driver glue. Consumes rolepod-mcp as a dependency.

### Out of audience
- People writing traditional e2e tests by hand without an AI agent. Use Playwright Test directly.
- Teams needing visual regression CI at scale. Use Percy, Chromatic, Lost Pixel. (rolepod-mcp's `visual_diff` is for in-loop agent feedback, not a CI gate.)
- LLM-driven natural language test authoring without an outer agent. Use alumnium or Stagehand.

## Problem statement

Today, an AI coding agent that wants to verify a UI change has three bad options:

1. **Tell the user to verify manually.** Breaks the agent's autonomy. Most rolepod skills end here.
2. **Use the existing Playwright MCP server.** Works for web, but the agent must orchestrate atomic actions step-by-step, and mobile is impossible. Naming conventions are Microsoft's; artifact paths don't fit rolepod's `check-work` evidence contract.
3. **Use alumnium or Stagehand.** Adds an internal LLM call per action — doubling cost and latency for an agent that already has an LLM (itself). Also binds the user to OpenAI by default.

rolepod-mcp closes this gap: one server, one tool surface, one install — for any platform the agent might need to verify against.

## Success metrics (post v1.0)

- **Adoption:** 1k+ npm weekly downloads within 6 months of v1.0.
- **Integration:** Used as the verification backend by at least one third-party agent framework other than rolepod.
- **Reliability:** <1% flaky failure rate on the bundled smoke test suite across web + iOS + Android.
- **Performance:** Median round-trip for `browser_snapshot` under 400ms on web; under 1.5s on mobile.
- **Contribution:** ≥3 external contributors in v1.0 cycle.
