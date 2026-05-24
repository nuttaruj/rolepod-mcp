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
  accessibility layers. See `brief/04-engine-layer.md` (D-005) for the fork
  rationale.

### Forked files

> **Note (v0.1):** The v0.1 PoC implements the Chromium accessibility path
> using Playwright's built-in `page.accessibility.snapshot()` directly and
> does **not** yet contain forked alumnium code. The alumnium fork lands in
> v0.2 alongside the full atomic + composite surface, and mobile drivers in
> v0.3. Files derived from alumnium will carry the header below.

When code is forked, each forked file will carry this header:

```
/*
 * Originally from alumnium-hq/alumnium (MIT License).
 * Source commit: <SHA>
 * Modified for rolepod-mcp.
 */
```

A `UPSTREAM_TRACKING.md` will be added when the first fork lands to record
the upstream commit SHA and date.

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
