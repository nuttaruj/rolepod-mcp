# 05 — Open Source Strategy

## License

- **rolepod-mcp itself:** MIT.
- **Forked code (drivers + AT extractors from alumnium):** preserves original MIT notice; attribution in `THIRD_PARTY.md` and per-file header.
- **Bundled dependencies:** all must be MIT, Apache-2.0, BSD, or ISC. No GPL/LGPL/AGPL. License audit runs in CI via `license-checker`.

## Positioning

### One-line positioning

> An MCP server that lets your AI coding agent verify, debug, and audit real web and mobile UIs — with no internal LLM, no per-platform glue, no vendor lock.

### Differentiation matrix

| Project | LLM inside | Web | iOS | Android | MCP-native | Phase tools | Artifact convention | Provider-neutral |
|---|---|---|---|---|---|---|---|---|
| **rolepod-mcp** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Playwright MCP (MS) | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Chrome DevTools MCP | ❌ | ✅ Chromium only | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| alumnium | ✅ | ✅ | ✅ | ✅ | ✅ (separate) | ❌ | partial | ❌ (OpenAI default) |
| Stagehand | ✅ | ✅ | ❌ | ❌ | partial | ❌ | ❌ | partial |
| Browserbase | ✅ | ✅ | ❌ | ❌ | partial | ❌ | ❌ | ❌ |

### What "phase tools" buys us

Existing MCP-native servers (Playwright MCP, Chrome DevTools MCP) expose only atomic actions. A Lead agent that wants to *verify a UI change* must orchestrate 10–20 atomic round-trips, each with its own LLM context cost.

rolepod-mcp's composite tools (`verify_ui_flow`, `audit_a11y`, `visual_diff`, etc.) collapse those into single calls. This isn't just ergonomic — it's a 5–20× reduction in LLM round-trip count for the most common verification workflows.

### What "artifact convention" buys us

Other MCP servers return data inline. rolepod-mcp returns paths into `./.rolepod-mcp/artifacts/{run_id}/`. The rolepod parent project's skills (especially `check-work`) know where to look for evidence, can reference paths in commit messages, can attach them to PRs. Other agents can adopt this convention or ignore it.

## Audience tiering

Open source positioning has to address three distinct audiences with different expectations:

### Audience A — rolepod plugin users

Already using rolepod with Claude Code / Codex / Gemini / Cursor. Install is one extra command. Documentation lives mostly in rolepod's parent README; rolepod-mcp's own README is short and refers back.

**Marketing surface:** rolepod's README, rolepod's plugin marketplace entry, `bootstrap.sh` interactive prompt.

### Audience B — independent MCP users

Use other AI coding agents and want a multi-platform UI primitive. They don't care about rolepod. The MCP server must stand alone with its own README, examples, and docs.

**Marketing surface:** the rolepod-mcp README, npm page, awesome-mcp lists, MCP server directory submissions.

### Audience C — framework integrators

Build their own AI agent framework and want rolepod-mcp as a dependency. They need stable schemas, semantic versioning, a published changelog, and integration tests they can run.

**Marketing surface:** the JSON schema export at `dist/schemas/tools.json`, the `CHANGELOG.md`, GitHub Discussions for design questions.

## Repository governance

### Maintainer model (initial)

- **Solo maintainer:** the rolepod author until v1.0.
- Decision-making by author until a second maintainer joins.
- After 2 maintainers: changes to schemas, license, or release process require consensus.

### Contribution model

- All contributions via GitHub PRs against `main`.
- DCO sign-off required (no CLA — DCO is lighter and equally protective for MIT).
- One maintainer approval required for merge.
- CI must pass: lint, typecheck, unit tests, smoke test on at least one engine.
- Issue template separates: bug, feature, schema change.

### Issue triage

- **`good first issue`** label for atomic-tool gaps, doc fixes, additional fixture apps.
- **`needs-spec`** label for proposals that change schemas — must produce a brief doc before code.
- **`engine-specific`** label with sub-labels `engine/playwright`, `engine/appium`, `engine/selenium` for clarity.

### Release cadence

- Pre-v1.0: weekly minor or patch as needed; no scheduled cadence.
- Post-v1.0: monthly minor on first Monday; patches as needed; majors announced 30 days ahead.

### Semantic versioning commitment

- Tool names and required field semantics are the API. Breaking changes to these require a major bump.
- Optional fields and new tools are minor.
- See `03-tool-surface.md → Versioning policy`.

## No-telemetry commitment

- rolepod-mcp **does not phone home**. No anonymous usage stats, no crash reporting, no auto-update checks.
- This is documented in README and SECURITY.md and is a *governance* commitment, not just a current state.
- Optional: a `--debug-log` flag writes structured logs locally for the user's own diagnostics.

This is a deliberate trust signal for security-sensitive users. (Many existing testing tools auto-send telemetry by default; rolepod-mcp's pitch includes "we don't watch you.")

## Naming and branding

| Asset | Value |
|---|---|
| npm package | `@rolepod/mcp` (scoped) — or `rolepod-mcp` (unscoped) if scope unavailable |
| GitHub org/repo | `nuttaruj/rolepod-mcp` initially; move to a `rolepod` org once registered |
| Binary name | `rolepod-mcp` |
| Logo | derived from rolepod's logomark; suffix or pod variant — defer to v0.5 |
| Tagline | "Multi-platform UI automation for AI agents — over MCP." |

The name signals continuity with rolepod (the parent plugin) while being parseable standalone. Users who don't know rolepod will read `rolepod-mcp` as a self-contained tool name.

## Marketing and discovery surface

### Day-1 (v0.1 release)

- README with quick start, demo gif, install command.
- A short blog post explaining the design (LLM-outside, fork strategy, phase tools).
- Submission to MCP server directory.

### v0.5

- Docs site (Astro). Sections: install, atomic tools, composite tools, engine setup, mobile setup, recipes.
- Example repo showing integration with Claude Code and Codex.

### v1.0

- Announcement post: comparison with existing options, real benchmark numbers.
- Talk/demo at a community event (MCP-related conference if one exists, or a community call).
- Cross-link from rolepod's README and CHEATSHEET.

## Community channels

- **GitHub Discussions** for design conversations and feature requests.
- **GitHub Issues** for bugs and concrete proposals.
- No Discord/Slack pre-v1.0 — solo maintainer cannot moderate a chat.
- A monthly office-hours thread in Discussions starting at v0.5.

## Backwards compatibility promise

After v1.0:

- Atomic tool names and required-field semantics are stable. Breakage requires a major.
- Composite tool *output* schemas are stable. Composite *input* schemas may add optional fields freely.
- Artifact path conventions (`.rolepod-mcp/artifacts/{run_id}/...`) are stable.
- Engine env vars are stable.
- The MCP transport (stdio) is stable; new transports may be added.

## Sustainability plan

- No paid features. Sponsorship via GitHub Sponsors only.
- If commercial value emerges, a separate optional paid product (e.g. a hosted device cloud or visual-diff baseline storage) — never a paid feature in the OSS package.
- License covenant: rolepod-mcp will not be relicensed away from MIT without a fork-friendly migration period.

## What "good open source citizenship" looks like here

- README explains *why* a user would pick this over Playwright MCP or alumnium — honestly.
- Contributors get reviewed within 7 days.
- Issues triaged within 14 days.
- Security disclosures (`SECURITY.md`) honored with a 90-day private window.
- Releases are reproducible — `npm pack` from a clean checkout matches the published artifact.
- Forked code is credited prominently, not in a footnote.
