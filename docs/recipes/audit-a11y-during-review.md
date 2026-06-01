# Recipe — Run an a11y audit during code review

Goal: catch axe-detectable accessibility regressions before merge,
with the reviewer's AI agent doing the work.

## 1. From inside the reviewer's session

> /audit-a11y https://staging.app.example.com at wcag-aa,
> report_format markdown

The skill calls `audit_a11y` with:

```json
{
  "open": { "platform": "web", "url": "https://staging.app.example.com" },
  "level": "wcag-aa",
  "scope": "page",
  "report_format": "markdown",
  "close_on_finish": true
}
```

Returns counts by severity (critical / serious / moderate / minor),
the issue list with WCAG references and fix links, and a path to a
markdown report.

## 2. Audit a single component, not the whole page

After a snapshot is taken in an existing session, point
`scope: { ref }` at the component to audit:

```json
{
  "open": { "platform": "web", "url": "https://staging.app.example.com" },
  "level": "wcag-aa",
  "scope": { "ref": "e14" },
  "report_format": "json"
}
```

Internally the composite tags that ref with a temporary
`data-rolepod-axe-scope` attribute, runs axe restricted to it, then
removes the attribute. The Lead sees a smaller issue list scoped to
the component under review.

## 3. Gate merges on severity

A reviewer (or a CI hook reading the report path) can post:

> `serious` or `critical` issues exist → request changes.
> Only `moderate` / `minor` → approve with a comment.

Because the report path is deterministic and the run id is recorded,
the same audit can be re-run after a fix without polluting the
session.
