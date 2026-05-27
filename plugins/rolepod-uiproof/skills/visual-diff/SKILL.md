---
name: visual-diff
description: Capture a screenshot of the current UI and compare against a stored baseline under ./.rolepod-uiproof/baselines/. First capture for a baseline_id seeds the baseline; subsequent capture diffs it.
---

# /visual-diff

Single-backend skill. Calls **`rolepod_visual_diff`** on the rolepod-uiproof
MCP server. No fallback (D-024).

## When to use

- Detecting visual regressions against a known-good baseline.
- Verifying a CSS / styling change does not perturb unrelated elements.

## When NOT to use

- No baseline exists yet AND the user is not OK with this run becoming
  the baseline (the first call always seeds).
- The page has highly dynamic content (rotating banners, timestamps,
  animations) — the diff will be noisy. Either freeze the dynamic content
  via a flag or pick a different verification approach.

## Inputs

- `target` — URL.
- `baseline_id` — short stable name (e.g. `homepage-light`, `checkout-success`).
- `viewport` — optional `{ width, height }` so the baseline and the current
  capture share dimensions. Default uses the browser's natural viewport.
- `threshold_pct` — tolerated diff fraction. Default `0.1` (= 10%).
- `pixel_threshold` — pixelmatch sensitivity 0..1. Default `0.1`.

## Outputs

- `run_id` — folder under `./.rolepod-uiproof/artifacts/`.
- `diff_pct` — fraction of differing pixels.
- `passed` — `diff_pct <= threshold_pct`.
- `baseline_path`, `current_path`, `diff_image_path`.

## Process

1. Build `rolepod_visual_diff` input from the user's intent.
2. Call the tool.
3. Report `diff_pct`, `passed`, and the three image paths. If the baseline
   was just seeded, say so explicitly.

## Evidence routing

Run artifacts are saved under:

- **Standalone:** `.rolepod-uiproof/artifacts/<prefix>_<ts>_<uuid>/`
- **With `rolepod` parent** (when `ROLEPOD_PARENT=1` is set by the parent's SessionStart hook): `.rolepod/evidence/<ts>-rolepod-uiproof-<skill>/`

Baselines under `.rolepod-uiproof/baselines/` are always the same location regardless of mode — they are user-curated config, not per-run evidence. Either way the run directory contains a `manifest.json` per Extension Protocol v1.

## If the tool is unavailable

Surface plainly:

> The `/visual-diff` skill needs the **rolepod-uiproof** MCP server, which is
> not currently available. Confirm the plugin is installed and try again.

Do not attempt another backend (D-024).

## Examples

### Seed a baseline then diff

First run:

```json
{
  "open": { "platform": "web", "url": "https://example.com" },
  "baseline_id": "example-home",
  "viewport": { "width": 1280, "height": 720 }
}
```

Returns `passed: true, diff_pct: 0, note: "Baseline did not exist…"`.

Second run (after a CSS change) returns `passed: false, diff_pct: 0.18,
diff_image_path: …diff.png`.
