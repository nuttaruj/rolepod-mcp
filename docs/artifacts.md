# Artifacts

Every artifact rolepod-uiproof produces lives under
`./.rolepod-uiproof/` in the working directory (D-026 — distinct from
parent `rolepod`'s `~/.rolepod/`).

```
./.rolepod-uiproof/
├── artifacts/
│   ├── verify_20260524T101512_a1b2c3d4/
│   │   ├── final.png            screenshot at end of run
│   │   ├── replay.json          replay bundle (always written)
│   │   └── replay-minimized.json   present when minimize ran
│   ├── audit_20260524T101840_f0e1d2c3/
│   │   └── report.json           or report.md when report_format='markdown'
│   ├── vdiff_20260524T102102_b6a5949/
│   │   ├── current.png
│   │   └── diff.png
│   ├── scaffold_…/
│   │   └── <generated test file>
│   └── snap_…/
│       └── shot.png              from browser_screenshot
└── baselines/
    ├── homepage-light.png        keyed by visual_diff baseline_id
    └── checkout-success.png
```

## Run ids

`<prefix>_<UTC-timestamp>_<random-8>`:

- `prefix` per composite: `verify` / `audit` / `vdiff` / `scaffold`,
  or `snap` for the atomic `browser_screenshot`.
- `timestamp`: `YYYYMMDDTHHMMSS` (UTC).
- `random`: 8 hex chars from `crypto.randomUUID()` for collision-safety
  under concurrent runs.

## Replay bundle (`replay.json`)

```jsonc
{
  "version": 1,
  "run_id": "verify_…",
  "recorded_at": "2026-05-24T10:15:12.000Z",
  "open":   { /* exact browser_open input — platform, url, etc. */ },
  "steps":  [ /* exact step list */ ],
  "expect": [ /* exact expectation list */ ]
}
```

Re-run a bundle deterministically with:

```bash
npx rolepod-uiproof replay .rolepod-uiproof/artifacts/verify_…/replay.json
```

The CLI returns exit code `0` if `passed`, `1` otherwise, and prints
the structured composite result to stdout.

Bundles are forward-compatible across minor versions (the schema only
grows). A `version` bump is a breaking change in the format.

## Visual baselines (`.rolepod-uiproof/baselines/`)

`visual_diff` looks for `<baseline_id>.png` in `baselines/`. On the
first call for a given id, the current capture is **saved as the
baseline** and the run reports `passed: true, diff_pct: 0`. Subsequent
calls compare against that baseline via `pixelmatch`.

To re-baseline (e.g. after an intentional design change), delete the
file:

```bash
rm .rolepod-uiproof/baselines/<baseline_id>.png
```

## Reports (`audit_a11y`)

JSON shape:

```jsonc
{
  "run_id": "audit_…",
  "level": "wcag-aa",
  "counts": { "critical": 0, "serious": 2, "moderate": 1, "minor": 0 },
  "issues": [
    {
      "wcag_ref": "wcag2aa",
      "severity": "serious",
      "ref": "image-alt#0",
      "description": "Images must have alternate text",
      "fix_suggestion": "https://dequeuniversity.com/rules/axe/4.x/image-alt",
      "target": "img.hero"
    }
  ]
}
```

Markdown reports use the same payload, rendered with sections per
severity.

## Generated test files (`scaffold_e2e`)

The generated file lives under
`./.rolepod-uiproof/artifacts/scaffold_<run_id>/<slug>.{spec.ts,test.ts,.py}`.
Move it into your project's test directory; the `setup_notes` in the
tool response say what to install and how to run.

## Gitignore

The repo's `.gitignore` excludes `.rolepod-uiproof/` so artifacts don't
pollute commits. If you want to **track** baselines under VCS, move
`.rolepod-uiproof/baselines/` to a project-controlled location and point
`visual_diff` at it (env-driven baseline root will land alongside
session-scoped overrides in a later milestone).
