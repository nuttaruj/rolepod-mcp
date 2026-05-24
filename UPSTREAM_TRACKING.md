# Upstream tracking

Records the upstream sources that have informed rolepod-mcp's design and
implementation, so that future cherry-picks or audits can locate them.

## alumnium-hq/alumnium (MIT)

- **Repo:** https://github.com/alumnium-hq/alumnium
- **Commit referenced:** `94dea1e6916c3fb8e38fc229a7c7c85aa6230d52`
- **Date referenced:** 2026-05-24
- **Used as:** Design reference for mobile accessibility-tree shape and
  the XCUITest / UIAutomator2 XML → unified tree mapping.

### Status

The brief (`brief/04-engine-layer.md`, D-005) originally specified a
*verbatim fork* of alumnium's `packages/typescript/src/drivers/` and
`packages/typescript/src/accessibility/`. After surveying the source
during v0.3 scaffolding we instead chose an **inspired-by**
reimplementation:

- alumnium uses bun-style `.ts` import extensions throughout; our
  Node + tsup setup uses `.js` resolution. Mass-renaming imports was
  the bulk of any literal fork effort.
- alumnium pulls four runtime XML deps (`domhandler`, `htmlparser2`,
  `dom-serializer`, `xml-formatter`) plus its internal `alwaysly`
  helper. `fast-xml-parser` (MIT, single dep) covers our needs.
- The accessibility-tree types in alumnium serve their LLM `Alumni`
  class; ours serve the unified `A11yNode` schema in
  `src/schema/tools.ts`, so the field set differs anyway.

### What we keep from alumnium

- The overall shape of the XCUITest and UIAutomator2 tree extractors —
  walk the Appium XML page source, assign stable refs, map native
  attributes (`name`, `label`, `value`, `content-desc`, `text`,
  `resource-id`, etc.) into a normalized accessibility shape.
- The decision to use Appium's `getPageSource` as the AT entry point
  for mobile (alumnium proved this is workable).

### What we DO NOT keep

- The `Alumni` / LLM-driven action loop (incompatible with our
  Lead-driven D-004 design).
- The `Xml` namespace + 4 XML parsing deps.
- The `pythonic*` polyfills.
- The CLI / MCP wrappers (we have our own).
- Literal source files.

### Quarterly cherry-pick policy

Each quarter, review alumnium's commit log between the SHA above and
their `HEAD`. Cherry-pick *behavioral* fixes that apply (a UIAutomator2
attribute we missed, an XCUITest edge case, etc.). We do **not** commit
to staying current on every bug fix; we commit to staying *correct*.

When alumnium fixes a behavioral bug we share, update this file with
the new SHA + date + a one-line note on what changed.
