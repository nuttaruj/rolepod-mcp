---
name: visual-diff
description: Capture a screenshot of the current UI and compare against a stored baseline under ./.rolepod-uiproof/baselines/. First capture for a baseline_id seeds the baseline; subsequent capture diffs it.
---

# /visual-diff

Single-backend skill. Calls **`visual_diff`** on the rolepod-uiproof
MCP server. No fallback (D-024).

## When to use

- Detecting visual regressions against a known-good baseline.
- Verifying a CSS / styling change does not perturb unrelated elements.

## When NOT to use

- No baseline exists yet AND the user is not OK with this run becoming
  the baseline (the first call always seeds).
- The page has truly dynamic *content* (rotating banners, live timestamps) —
  the diff will be noisy. `settle` (default on) already freezes CSS animations
  and reveals scroll content; for changing content, scope with `selector` or
  pick a different verification approach.

## Inputs

- `target` — URL.
- `baseline_id` — short stable name (e.g. `homepage-light`, `checkout-success`).
- `viewport` — optional `{ width, height }` so the baseline and the current
  capture share dimensions. Default uses the browser's natural viewport.
- `threshold_pct` — tolerated diff fraction. Default `0.1` (= 10%).
- `pixel_threshold` — pixelmatch sensitivity 0..1. Default `0.1`.
- `settle` — default `true`. Before capture, scroll the full page to trigger
  scroll-reveal (opacity:0 + IntersectionObserver) and lazy media, wait for
  network idle, freeze animations, return to top. Set `false` for static pages
  or to reproduce the legacy immediate capture.
- `selector` — optional CSS selector. Diff only that element's bounding box
  instead of the whole page (region-scoped). Use a distinct `baseline_id` per
  region.

## Outputs

- `run_id` — folder under `./.rolepod-uiproof/artifacts/`.
- `diff_pct` — fraction of differing pixels.
- `passed` — `diff_pct <= threshold_pct` (and dimensions match).
- `baseline_path`, `current_path`, `diff_image_path`.
- `dimension_mismatch` + `dimensions` — when baseline and current differ in
  size, the overlap is diffed and `dimensions` carries baseline/current sizes
  + width/height deltas. A mismatch fails the check; re-seed if the new size is
  intended.

## Process

1. Build `visual_diff` input from the user's intent.
2. Call the tool.
3. Report `diff_pct`, `passed`, and the three image paths. If the baseline
   was just seeded, say so explicitly.

## Evidence routing

Run artifacts are saved under:

- **Standalone:** `.rolepod-uiproof/artifacts/<prefix>_<ts>_<uuid>/`
- **With `rolepod` parent** (detected via the marker file `<git-root>/.rolepod/parent-active` written by the parent's SessionStart hook): `<git-root>/.rolepod/evidence/<ts>-rolepod-uiproof-<skill>/`

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
