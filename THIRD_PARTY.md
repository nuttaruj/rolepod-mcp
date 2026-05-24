# Third-Party Notices

rolepod-mcp depends on and (in later milestones) incorporates code from the
following third-party projects. All listed projects are MIT-licensed and
compatible with this project's MIT license (see `LICENSE`).

---

## alumnium

- **Project:** [alumnium-hq/alumnium](https://github.com/alumnium-hq/alumnium)
- **License:** MIT
- **Used for:** Driver abstraction and accessibility-tree extractors for
  Chromium (web), XCUITest (iOS), and UIAutomator2 (Android).
- **Relationship:** Code is **forked** (copied with modification), not
  depended on as an npm package. The LLM-driven `Alumni` class, LangChain
  bindings, and OpenAI integration are **not** copied — only the driver and
  accessibility layers. See `UPSTREAM_TRACKING.md` for the fork rationale,
  the upstream commit referenced, and the cherry-pick policy.

### Forked files

> **Note (v0.3):** After surveying alumnium during scaffolding we chose
> an **inspired-by** reimplementation rather than a verbatim fork. See
> [`UPSTREAM_TRACKING.md`](UPSTREAM_TRACKING.md) for the reasoning,
> the upstream commit SHA referenced, and the quarterly cherry-pick
> policy.
>
> The Chromium AT path uses Playwright 1.60's built-in
> `page.ariaSnapshot({mode:'ai'})` directly. The mobile AT extractors
> (`src/engine/a11y/xcuitest.ts`, `uiautomator2.ts`) are
> alumnium-inspired Original code parsing Appium's XML page source via
> `fast-xml-parser`.
>
> Should literal alumnium source be copied in a future revision, each
> file will carry this header:
>
> ```
> /*
>  * Originally from alumnium-hq/alumnium (MIT License).
>  * Source commit: <SHA>
>  * Modified for rolepod-mcp.
>  */
> ```

### Upstream MIT notice

```
MIT License

Copyright (c) alumnium-hq contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Runtime npm dependencies

The following npm packages are direct runtime dependencies. Each retains its
own license; this section is acknowledgement only.

- `@modelcontextprotocol/sdk` — MIT — MCP protocol implementation.
- `playwright` — Apache-2.0 — Web automation engine for the `web` platform.
- `zod` — MIT — Tool input/output schema validation.
- `js-yaml` — MIT — Parses Playwright's `ariaSnapshot({mode:'ai'})` YAML
  output into the unified `A11yNode` tree.
- `@axe-core/playwright` — MPL-2.0 — Powers the `rolepod_audit_a11y`
  composite. axe-core is dual-licensed MPL-2.0 (weak copyleft); using it
  as an unmodified runtime dependency is compatible with this project's
  MIT license. We do not modify axe-core source.
- `pixelmatch` — ISC — Pixel-level image comparison for
  `rolepod_visual_diff`.
- `pngjs` — MIT — PNG encode/decode for baseline + diff images in
  `rolepod_visual_diff`.
- `fast-xml-parser` — MIT — Parses Appium's XML page source in the
  mobile AT normalizers (`xcuitest.ts`, `uiautomator2.ts`).

## Optional npm dependencies

- `webdriverio` — MIT — Loaded lazily by `AppiumEngine` when a mobile
  session is requested. Web-only installs skip it via npm
  `optionalDependencies`.

## Build-time-only dependencies

- `zod-to-json-schema` — ISC — Used by `npm run build:schemas` to emit
  `dist/schemas/tools.json`. Not shipped at runtime.
