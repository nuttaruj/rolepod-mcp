---
name: audit-a11y
description: Run an axe-core accessibility audit on a page against WCAG-A / WCAG-AA / WCAG-AAA and return issues grouped by severity with WCAG references and fix links. v0.2 web only; scope='page' only.
---

# /audit-a11y

Single-backend skill. Calls **`rolepod_audit_a11y`** on the rolepod-uiproof
MCP server. No fallback (D-024).

## When to use

- Reviewing a UI for accessibility compliance before merging.
- After a UI change that touches markup, ARIA, or interactive components.
- During a periodic accessibility regression sweep.

## When NOT to use

- Backend-only diffs.
- Pages that fail to render (server 500, blank page) — fix the page first.
- Auditing a single component when the rest of the page is not under test;
  scope-to-ref is **v0.3** (currently scope='page' only).

## Inputs

- `target` — URL to audit.
- `level` — `wcag-a` | `wcag-aa` | `wcag-aaa`. Default `wcag-aa`.
- `report_format` — `json` | `markdown`. Default `json`.

## Outputs

- `run_id` — folder under `./.rolepod-uiproof/artifacts/`.
- `counts` — issue counts by severity.
- `issues[]` — each `{ wcag_ref, severity, ref, description, fix_suggestion, target }`.
- `report_path` — path to the JSON or markdown report.

## Process

1. Build `rolepod_audit_a11y` input from the user's intent:
   - `open: { platform: 'web', url: <target> }`
   - `level`, `report_format`.
2. Call the tool.
3. Surface counts + critical/serious issues inline; reference the report
   path for the full list.

## If the tool is unavailable

Surface plainly:

> The `/audit-a11y` skill needs the **rolepod-uiproof** MCP server, which is
> not currently available. Confirm the plugin is installed and try again.

Do not attempt another backend (D-024).

## Examples

### Audit example.com at WCAG-AA

```json
{
  "open": { "platform": "web", "url": "https://example.com" },
  "level": "wcag-aa",
  "report_format": "json"
}
```

Returns:

```json
{
  "run_id": "audit_…",
  "counts": { "critical": 0, "serious": 0, "moderate": 0, "minor": 0 },
  "issues": [],
  "report_path": ".rolepod-uiproof/artifacts/audit_…/report.json"
}
```
