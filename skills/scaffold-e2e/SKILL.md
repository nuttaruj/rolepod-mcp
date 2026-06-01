---
name: scaffold-e2e
description: Generate a runnable e2e test file (playwright-test, vitest+playwright, or pytest+selenium) from a scenario description plus an optional replay bundle from a prior /verify-ui run.
---

# /scaffold-e2e

Single-backend skill. Calls **`scaffold_e2e`** on the rolepod-uiproof
MCP server. No fallback (D-024).

## When to use

- The user asks to generate an e2e test for a flow they just verified
  interactively.
- A replay bundle from `/verify-ui` exists and should be transcribed into
  a real test file.

## When NOT to use

- A unit or integration test is sufficient — pick a closer framework
  manually.
- The scenario is too vague to scaffold — ask the user to clarify before
  calling.

## Coverage

The codegen handles every step kind and expect kind supported by
`/verify-ui` (click, type, key, navigate, wait_for, hover, drag,
fill_form, upload, dialog, set_env, switch_page, evaluate; text_visible,
text_absent, url_matches, ref_in_state, no_console_errors,
no_failed_requests, request_made, response_status).

Playwright-test gets first-class translation for everything that has a
direct Playwright API. Pytest+selenium covers the basics; expect kinds
that need network introspection (no_failed_requests, request_made,
response_status) emit a TODO referencing `selenium-wire` or BiDi, since
upstream Selenium has no network-capture primitive.

## Inputs

- `framework` — `playwright-test` | `vitest+playwright` | `pytest+selenium`.
- `scenario_nl` — natural-language description of the scenario.
- `url` — entry URL.
- `recorded_bundle` *(optional)* — path to a replay bundle from a prior
  `/verify-ui` run; when present, steps and expectations are transcribed.
- `filename` *(optional)* — override the generated file name.

## Outputs

- `run_id` — folder under `./.rolepod-uiproof/artifacts/`.
- `test_file_path` — path to the generated test file.
- `language` — `typescript` | `python`.
- `dependencies` — packages the user needs to install.
- `setup_notes` — what to run after install.
- `from_replay_bundle` — boolean indicating whether the file was
  transcribed from a recorded run.

## Process

1. Build `scaffold_e2e` input.
2. Call the tool.
3. Print the generated file path and the setup steps. Surface
   `dependencies` as an install command.

## Evidence routing

Run artifacts (the generated test file) are saved under:

- **Standalone:** `.rolepod-uiproof/artifacts/<prefix>_<ts>_<uuid>/`
- **With `rolepod` parent** (detected via the marker file `<git-root>/.rolepod/parent-active` written by the parent's SessionStart hook): `<git-root>/.rolepod/evidence/<ts>-rolepod-uiproof-<skill>/`

Either way the run directory contains a `manifest.json` per Extension Protocol v1 (with `phase: "build"` for this skill).

## If the tool is unavailable

Surface plainly:

> The `/scaffold-e2e` skill needs the **rolepod-uiproof** MCP server, which
> is not currently available. Confirm the plugin is installed and try
> again.

Do not attempt another backend (D-024).

## Examples

### Transcribe a replay bundle to a Playwright Test file

```json
{
  "framework": "playwright-test",
  "scenario_nl": "user opens example.com and clicks Learn more",
  "url": "https://example.com",
  "recorded_bundle": ".rolepod-uiproof/artifacts/verify_…/replay.json"
}
```

Returns:

```json
{
  "run_id": "scaffold_…",
  "test_file_path": ".rolepod-uiproof/artifacts/scaffold_…/user-opens-example-com-and-clicks-learn-more.spec.ts",
  "language": "typescript",
  "dependencies": ["@playwright/test"],
  "setup_notes": "Install: npm i -D @playwright/test && npx playwright install. Run: npx playwright test.",
  "from_replay_bundle": true
}
```
