# Recipe — Visual baseline workflow

Goal: keep a small set of stable visual baselines that catch regressions
without becoming noisy.

## 1. Seed each baseline once

```
/visual-diff https://app.example.com/dashboard
baseline_id "dashboard-light" viewport 1280x800
```

First call: the screenshot is saved as
`.rolepod-mcp/baselines/dashboard-light.png` and the run reports
`passed: true, diff_pct: 0, note: "Baseline did not exist…"`.

## 2. Diff on subsequent runs

Same command, second call:

```json
{
  "run_id": "vdiff_…",
  "baseline_id": "dashboard-light",
  "diff_pct": 0.012,
  "diff_pixels": 12450,
  "total_pixels": 1024000,
  "passed": true,
  "baseline_path": ".rolepod-mcp/baselines/dashboard-light.png",
  "current_path":  ".rolepod-mcp/artifacts/vdiff_…/current.png",
  "diff_image_path": ".rolepod-mcp/artifacts/vdiff_…/diff.png"
}
```

The diff image highlights changed regions in red. Inspect it before
deciding the failure is real.

## 3. Lock the viewport

Always pass an explicit `viewport`. Different browsers / OSes render
different default viewports, which produces dimension mismatches and
spurious diffs.

```json
{ "viewport": { "width": 1280, "height": 800 } }
```

## 4. Tune the threshold per baseline

| `threshold_pct` | When |
|---|---|
| `0.001` (≈0.1%) | Pixel-perfect components: icons, logos, hero images. |
| `0.05` (5%) | Pages with subtle anti-aliasing differences across OSes. |
| `0.20` (20%) | Pages with controlled dynamic regions (avatars, timestamps that you can't freeze yet). |

`pixel_threshold` is a separate knob for `pixelmatch` sensitivity at
the pixel level (0 = strict colour match, 1 = treat near-colours as
equal). Default `0.1` is usually right.

## 5. Re-baseline after an intentional change

```
rm .rolepod-mcp/baselines/dashboard-light.png
```

Next call re-seeds. Commit the new baseline if you track baselines
under VCS.

## 6. Storing baselines under VCS

The repo's `.gitignore` excludes `.rolepod-mcp/`. If you want to
track baselines, copy them into a project-controlled path (e.g.
`tests/visual-baselines/`) and adjust your call sites — until the
`ROLEPOD_MCP_BASELINE_DIR` env override lands, you can symlink:

```
ln -s ../../tests/visual-baselines .rolepod-mcp/baselines
```
