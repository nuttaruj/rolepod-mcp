---
name: verify-ui
description: Drive a real browser session through steps and assert expected outcomes; save evidence under ./.rolepod-mcp/artifacts/. Use when a diff changes visible behavior and code-level tests do not prove it. v0.1 web only.
---

# /verify-ui

Single-backend skill. Calls **`rolepod_verify_ui_flow`** on the rolepod-mcp
MCP server and surfaces the structured result. No fallback (D-024) — if the
tool is unavailable, this skill fails with a clear diagnostic so the caller
(typically the user, or the parent `rolepod` plugin's `check-work` skill)
can decide what to do next.

## When to use

- A diff changes user-visible behavior on a web target.
- A URL is reachable (dev server is running, or the target is a deployed URL).
- Code-level tests (unit, type-check, lint) do not prove the visible
  outcome.

## When NOT to use

- Backend-only diffs (no UI change).
- Doc, config, or build-tool changes with no behavior surface.
- No dev server / target available — ask the user to spin one up first
  before invoking.
- The user wants a bug **reproduction** with step minimization. That is
  `mode: 'reproduce'`, which lands in **v0.2**. v0.1 supports
  `mode: 'assert'` only.
- iOS / Android targets — mobile ships in v0.3 (`platform: 'ios' | 'android'`).

## Inputs

- `target` — the URL to open (web only in v0.1).
- `steps` — ordered UI actions. Each is one of:
  - `{ kind: 'click', query: <accessible name substring> }`
  - `{ kind: 'type', query: <accessible name substring>, text: <string>, clear_first?: boolean }`
  - `{ kind: 'key', key: <e.g. 'Enter'> }`
  - `{ kind: 'wait_for', condition: { kind, ... } }`
  - `{ kind: 'navigate', url: <string> }`
- `expect` — ordered assertions. Each is one of:
  - `{ kind: 'text_visible', text: <string> }`
  - `{ kind: 'text_absent', text: <string> }`
  - `{ kind: 'url_matches', pattern: <regex string> }`
  - `{ kind: 'ref_in_state', query: <accessible name substring>, state: 'visible' | 'enabled' | 'focused' }`
- `capture` *(optional)* — defaults to `['screenshot']`. v0.1 only emits
  screenshots and a replay bundle; HAR / console / video land in later
  milestones.
- `close_on_finish` *(optional)* — defaults to `true`.

## Outputs

- `run_id` — folder name under `./.rolepod-mcp/artifacts/`.
- `passed` — boolean.
- `failed_at_step` *(when not passed)* — 0-based step index.
- `failure_reason` *(when not passed)* — human-readable explanation.
- `evidence_paths` — `{ screenshots: string[], replay_bundle?: string }`.
- `final_url_or_screen` — page URL at the end of the run.

## Process

1. Construct a `rolepod_verify_ui_flow` input from the user's intent:
   - `mode: 'assert'`
   - `open: { platform: 'web', url: <target> }`
   - `steps`, `expect`, `capture`, `close_on_finish` per inputs above.
2. Call the tool.
3. Report the structured result. If `passed: false`, include
   `failed_at_step`, `failure_reason`, and the screenshot path so the user
   can inspect the failure.

## If the tool is unavailable

The rolepod-mcp MCP server is not registered or is not responding. Surface
this plainly:

> The `/verify-ui` skill needs the **rolepod-mcp** MCP server, which is
> not currently available. Confirm the plugin is installed and try again,
> or check that `npx -y @rolepod/mcp` is reachable.

Do **not** attempt this work via Playwright MCP, Chrome DevTools MCP, or
any other backend from inside this skill. Multi-backend routing is the
job of the parent `rolepod` plugin's `check-work` / `debug-issue` skills
(D-024).

## Examples

### Success — verify a search result on example.com

User: "Verify that opening https://example.com shows the heading 'Example
Domain' and links to iana.org."

Skill invokes `rolepod_verify_ui_flow` with:

```json
{
  "mode": "assert",
  "open": { "platform": "web", "url": "https://example.com" },
  "steps": [],
  "expect": [
    { "kind": "text_visible", "text": "Example Domain" },
    { "kind": "text_visible", "text": "More information" }
  ]
}
```

Returns:

```json
{
  "run_id": "verify_20260524T101512_a1b2c3d4",
  "passed": true,
  "evidence_paths": {
    "screenshots": [".rolepod-mcp/artifacts/verify_…/final.png"],
    "replay_bundle": ".rolepod-mcp/artifacts/verify_…/replay.json"
  },
  "final_url_or_screen": "https://example.com/"
}
```

### Failure — MCP server not available

The MCP server is not registered. The skill returns:

> The `/verify-ui` skill needs the **rolepod-mcp** MCP server, which is
> not currently available. Confirm the plugin is installed and try again.

No other backend is attempted. The caller decides whether to escalate to
the parent rolepod plugin's `check-work` skill.
