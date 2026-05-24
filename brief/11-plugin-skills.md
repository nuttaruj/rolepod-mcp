# 11 — Plugin Skills (Spec)

> **Important:** The skills shipped inside the rolepod-mcp plugin are **single-backend**. They call rolepod-mcp tools and only rolepod-mcp tools. There is no fallback chain in a shipped skill. Multi-backend fallback lives in the parent rolepod plugin's skills (`check-work`, `debug-issue`, `using-rolepod`). See `06-skill-integration.md` for the parent-side routing.

This document specifies the skills shipped inside the rolepod-mcp plugin. Each skill is markdown loaded by the CLI plugin loader and made available to the Lead.

## Plugin layout for skills

```
rolepod-mcp/
├── .claude-plugin/
│   └── plugin.json
├── .cursor-plugin/
│   └── plugin.json
├── .codex-plugin/
│   └── plugin.json
├── .gemini-plugin/
│   └── plugin.json
├── skills/
│   ├── verify-ui/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── audit-a11y/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── visual-diff/
│   │   └── SKILL.md
│   └── scaffold-e2e/
│       └── SKILL.md
```

**Four** user-invocable skills. The composite tool `rolepod_extract_ui_state` is **not** a user-facing skill; it is called by other skills internally.

Bug reproduction is **not** a separate skill. It is `mode: 'reproduce'` of `/verify-ui` — same shape (drive + assert), different semantic (assertion = bug surfaces) plus an extra post-processing step (step minimization). See D-025 in `08-decisions.md`.

## Shipped skill list

| Slug | Slash command | Wraps composite tool |
|---|---|---|
| `verify-ui` | `/verify-ui` | `rolepod_verify_ui_flow` (mode: assert \| reproduce) |
| `audit-a11y` | `/audit-a11y` | `rolepod_audit_a11y` |
| `visual-diff` | `/visual-diff` | `rolepod_visual_diff` |
| `scaffold-e2e` | `/scaffold-e2e` | `rolepod_scaffold_e2e` |

Each skill calls exactly one tool. No fallback. If the tool is unavailable, the skill returns a structured failure with a clear diagnostic message.

## Skill markdown template (single-backend)

Every shipped skill follows this contract. The template is enforced by a lint script in the rolepod-mcp repo.

```markdown
---
name: <slug>
description: <one sentence, action-oriented, used by CLI for skill discovery>
---

## When to use

<Concrete triggers — what kind of task makes this skill appropriate.>

## When NOT to use

<Explicit non-fit cases. Crucial for the Lead to know when to skip.>

## Inputs

<Structured inputs the skill needs from the user or surrounding context.>

## Outputs

<What the skill returns: artifact paths, pass/fail, structured summary.>

## Process

1. Construct the input for `rolepod_<tool>` from the user's intent.
2. Call the tool.
3. Return the result to the conversation.

## If the tool is unavailable

The rolepod-mcp MCP server is not registered or is not responding.

- Confirm the plugin is installed.
- Check that the MCP server is reachable: try restarting the CLI session.
- Run `rolepod-mcp doctor` for diagnostics.

Do NOT attempt the work via any other backend. Return a structured failure so the caller (often the user or a parent skill like `check-work`) can decide how to handle it.

## Examples

<Realistic invocation transcripts.>
```

## Skill spec — `/verify-ui`

```markdown
---
name: verify-ui
description: Drive a real browser or mobile session through steps and assert expected outcomes; save evidence.
---

## When to use

- A diff changes user-visible behavior on web, iOS, or Android.
- Code-level tests do not prove the visible change works.
- A URL or app target is reachable.

## When NOT to use

- Backend-only diffs.
- Doc, config, or build-tool changes that have no visible behavior.
- No dev server or app target available — ask the user to spin one up first.

## Inputs

- `target` — URL for web, bundle id for iOS, package name for Android.
- `platform` — `web` | `ios` | `android`. Default: `web`.
- `steps` — ordered list of UI actions in natural language.
- `expect` — ordered list of assertions in natural language.
- `capture` — optional list: `screenshot`, `har`, `console`, `a11y_tree`, `video`.

## Outputs

- `passed` — boolean.
- `evidence_paths` — paths under `./.rolepod-mcp/artifacts/{run_id}/`.
- `failure_reason` — if not passed, what assertion broke and at which step.
- `replay_bundle` — JSON file with the exact step sequence, replayable in CI.

## Process

1. Construct the structured input for `rolepod_verify_ui_flow` from the user's intent and the args above.
2. Call the tool.
3. Return the structured result to the conversation, including any evidence paths.

## If the tool is unavailable

The rolepod-mcp MCP server is not registered or not responding. Surface this clearly:

> The `/verify-ui` skill needs the rolepod-mcp MCP server, which is not currently available. Confirm the plugin is installed and try again, or run `rolepod-mcp doctor`.

Do not try Playwright MCP or any other backend from this skill. Multi-backend routing is the responsibility of the parent rolepod plugin's `check-work` skill, not this one.

## Examples

[transcript of a checkout flow on web]
[transcript of a login flow on iOS]
[transcript of an unavailable-server failure]
```

## Skill spec — `/audit-a11y`

```markdown
---
name: audit-a11y
description: Run an accessibility audit on a page or screen against WCAG levels and return categorized issues.
---

## When to use

- Reviewing a UI component or page for accessibility compliance.
- After implementing a feature, before merge, when accessibility is in the project's quality bar.

## When NOT to use

- The change has no visible UI surface.
- The page is not yet rendering content (server returns 500, etc.).

## Inputs

- `target` — URL or app target.
- `level` — `wcag-a` | `wcag-aa` | `wcag-aaa`. Default: `wcag-aa`.
- `scope` — optional element reference if auditing a specific component.

## Outputs

- `issues` — list of `{ wcag_ref, severity, ref, description, fix_suggestion }`.
- `report_path` — JSON or markdown report file.

## Process

1. Construct the structured input for `rolepod_audit_a11y`.
2. Call the tool.
3. Return the result with issues grouped by severity.

## If the tool is unavailable

Same as `/verify-ui` — surface the error, do not fall back to anything else.
```

## Skill spec — `/visual-diff`

```markdown
---
name: visual-diff
description: Capture a screenshot of the current UI and compare against a stored baseline.
---

## When to use

- Reviewing visual changes against a known-good baseline.
- The project tracks baselines under version control or a stable storage location.

## When NOT to use

- No baseline exists yet — the first capture is the baseline; subsequent captures compare.
- The page has highly dynamic content (animations, timestamps) that will produce noise.

## Inputs

- `target` — URL or app target.
- `baseline_id` — user-named baseline identifier.
- `viewport` — optional dimensions.
- `threshold_pct` — diff tolerance. Default 0.1.

## Outputs

- `diff_pct` — percentage of changed pixels.
- `passed` — within threshold.
- `baseline_path`, `current_path`, `diff_image_path`.

## Process

1. Construct input for `rolepod_visual_diff`.
2. Call the tool.
3. Return the result.

## If the tool is unavailable

Same handling as other shipped skills.
```

## Skill spec — `/scaffold-e2e`

```markdown
---
name: scaffold-e2e
description: Generate a runnable e2e test file from a natural-language scenario and the chosen framework.
---

## When to use

- The user asks to generate an e2e test.
- A replay bundle from a prior `/verify-ui` run is available and should be transcribed into a test file.

## When NOT to use

- Unit tests or integration tests are sufficient — pick a closer framework manually.

## Inputs

- `framework` — `playwright-test` | `vitest+playwright` | `pytest+selenium`.
- `scenario_nl` — natural-language scenario.
- `target` — entry URL.
- `recorded_bundle` — optional replay bundle path from a prior verify run.

## Outputs

- `test_file_path` — generated test file.
- `language` — `typescript` | `python`.
- `dependencies` — packages to install.
- `setup_notes` — anything the user needs to do before running.

## Process

1. Construct input for `rolepod_scaffold_e2e`.
2. Call the tool.
3. Write the returned file to disk; print path and any setup steps.

## If the tool is unavailable

Same handling as other shipped skills.
```

## Plugin manifest — Claude Code

`.claude-plugin/plugin.json`:

```json
{
  "name": "rolepod-mcp",
  "version": "0.1.0",
  "description": "Multi-platform UI/mobile automation for AI agents.",
  "author": "rolepod",
  "license": "MIT",
  "homepage": "https://github.com/nuttaruj/rolepod-mcp",
  "skills": [
    { "path": "skills/verify-ui" },
    { "path": "skills/audit-a11y" },
    { "path": "skills/visual-diff" },
    { "path": "skills/scaffold-e2e" }
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

Final field names follow the Claude Code plugin schema (verified during scaffolding).

## Plugin manifest — Cursor

`.cursor-plugin/plugin.json` follows Cursor's schema. Same skills and MCP server declaration apply, mapped to Cursor's field names. See rolepod parent's `.cursor-plugin/` for the established pattern.

## Plugin manifest — Codex

Codex CLI plugin convention. Pattern follows rolepod parent's existing Codex adapter.

## Plugin manifest — Gemini

Same approach; convention TBD when scaffolding (rolepod parent has a Gemini adapter to reference).

## Cross-CLI compatibility approach

The skills under `skills/` are CLI-agnostic markdown. Each `.<cli>-plugin/plugin.json` points at the same skill directories.

If a CLI has a quirky skill loading mechanism (e.g. different frontmatter field), wrap in a tiny adapter file that re-exports the canonical skill — never duplicate the skill body.

## Lint and test for shipped skills

- **Lint:** each `SKILL.md` is validated against the template — required sections present, **no fallback chain section** (that lives only in parent rolepod skills), examples included.
- **Tool reference check:** every `rolepod_*` tool name in skill markdown must exist in `src/schema/tools.ts`. CI fails on drift.
- **Examples:** every skill ships at least two examples — a success case and a tool-unavailable case.
- **Single-backend assertion:** automated check that no shipped skill references a non-rolepod tool name (`browser_*`, `puppeteer_*`, etc.). If one does, CI fails with the message "Shipped skills must use rolepod-mcp tools only. Move backend fallback to the parent rolepod plugin."

## Skill discovery surfaces

Once installed, each CLI surfaces the skills differently. The description in frontmatter is what shows up in:

- Claude Code: `/<skill-name>` completion list and "available skills" reminder.
- Cursor: command palette skill picker.
- Codex: skill list in CLI help.
- Gemini: same.

A good description is short, action-oriented, and uses verbs the Lead will recognize from trigger conditions.

## Version policy for skills

Skill semantics are part of the plugin's public API:

- Adding a new optional input field: minor version.
- Renaming a skill or removing a required input: major version.
- Removing a skill: major version.

The skill version is the plugin version. Skills and MCP tools rev together.

## What skills do NOT do

- **Do not call multiple composites in one skill.** A skill maps to exactly one composite tool. If a workflow needs two composites, it's two skill invocations (typically orchestrated by the parent rolepod's phase skill).
- **Do not contain fallback chains.** That logic lives in the parent rolepod plugin. Shipped skills are single-backend.
- **Do not embed business logic specific to a project.** Skills are generic; project-specific logic belongs in the project's CLAUDE.md or scripts.
- **Do not require the user to know the underlying tool name.** Skills hide tool naming from the Lead's user-facing interaction.

## Standalone-vs-integrated skill behavior

A shipped skill behaves identically whether or not the rolepod parent plugin is installed. The parent's role is only to *route* — to suggest the right skill from inside another skill (`check-work`, `debug-issue`, `using-rolepod`) and to fall back to non-rolepod-mcp backends when rolepod-mcp is not available.

Once a shipped skill is invoked, it runs the same logic in both modes. This means contributors to rolepod-mcp can test skills standalone without setting up the rolepod parent.

## Failure model — clear, no silent recovery

When a shipped skill's underlying tool fails or is unavailable:

- The skill returns a structured failure with a diagnostic message identifying the rolepod-mcp server as the problem.
- The skill does **not** try anything else.
- The caller (user, or a parent rolepod skill that delegated to this one) decides what to do next.

This is the single most important behavior contract for shipped skills. It is what keeps the plugin honest and predictable.
