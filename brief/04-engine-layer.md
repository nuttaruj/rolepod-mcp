# 04 — Engine Layer & Fork Strategy

## What the engine layer owns

The `Engine` interface is the single seam between rolepod-mcp's tool layer and any browser/mobile automation backend.

```ts
// src/engine/Engine.ts (sketch — final shape may differ)
export interface Engine {
  readonly id: 'playwright' | 'appium' | 'selenium'

  open(opts: OpenOptions): Promise<Session>
  close(session: Session): Promise<void>

  snapshot(session: Session, mode?: 'visible' | 'full'): Promise<A11ySnapshot>
  click(session: Session, ref: string, opts?: ClickOpts): Promise<void>
  type(session: Session, ref: string, text: string, opts?: TypeOpts): Promise<void>
  key(session: Session, key: string): Promise<void>
  scroll(session: Session, dir: Direction, amount?: number, ref?: string): Promise<void>
  waitFor(session: Session, cond: WaitCondition, timeoutMs?: number): Promise<void>
  screenshot(session: Session, fullPage?: boolean): Promise<Buffer>
  navigate(session: Session, url: string): Promise<void>   // web only; throws on mobile
}
```

**Anything outside this interface is the tool layer's job.** Composites are *not* engine concerns.

## Three engine implementations

| Engine | Web | iOS | Android | Status |
|---|---|---|---|---|
| `PlaywrightEngine` | ✅ Chromium/FF/WebKit | ❌ | ❌ | v0.1 default |
| `AppiumEngine` | ❌ | ✅ XCUITest | ✅ UIAutomator2 | v0.3 |
| `SeleniumEngine` | ✅ (legacy grid) | ❌ | ❌ | v0.4, optional |

The platform-to-engine routing happens in `OpenOptions.platform`:

```ts
platform: 'web'      → PlaywrightEngine (default) or SeleniumEngine (if env override)
platform: 'ios'      → AppiumEngine (XCUITest driver)
platform: 'android'  → AppiumEngine (UIAutomator2 driver)
```

## Why three engines, not one

A single Playwright-based engine would cover web well but not native mobile (Playwright is web-only as of 2026). The only library family that spans web + iOS + Android with a stable interface is the WebDriver/Appium family, and Appium is *not* the right tool for web (slower, heavier, less ergonomic than Playwright). So we accept the cost of two real engines plus an optional Selenium one.

This is the architectural concession that makes the "one MCP for everything" promise honest.

## Fork strategy: alumnium driver + AT layer

[alumnium-hq/alumnium](https://github.com/alumnium-hq/alumnium) is MIT-licensed and already implements:

- Driver abstraction over Playwright, Selenium, Appium.
- Accessibility tree extractors for Chromium, XCUITest (iOS), UIAutomator2 (Android).
- A unified AT-tree shape with stable refs.

This is the load-bearing part of alumnium that rolepod-mcp needs and would otherwise re-invent. The rest of alumnium (the `Alumni` class, the LLM-driven `do/check/get` loop, the OpenAI integration, the langchain dependency) is **not** something we want.

### Decision: fork the driver + AT layer, drop the LLM layer

- **Copy** these directories from alumnium's TypeScript package:
  - `packages/typescript/src/drivers/`
  - `packages/typescript/src/accessibility/`
  - Selected helpers from `packages/typescript/src/clients/typecasting.ts`, `packages/typescript/src/Xml.ts`, `packages/typescript/src/drivers/scripts/`
- **Do not copy** these:
  - `packages/typescript/src/client/Alumni.ts` (LLM-driven API)
  - `packages/typescript/src/llm/*` (LangChain bindings, prompts)
  - `packages/typescript/src/mcp/*` (alumnium's own MCP wrappers — different design)
  - `packages/typescript/src/cli/*` (their CLI is irrelevant to us)

### Why fork instead of depend

Depending on `alumnium` as an npm package would pull in:

- LangChain core (~30MB transitive)
- OpenAI SDK
- Internal classes that are *not* stable public API and will change

The driver/AT layer is small (~3k LOC TS) and self-contained. The maintenance cost of a fork is lower than the version-skew risk of a dependency.

### Attribution requirements

- **THIRD_PARTY.md** at repo root: full alumnium MIT notice, list of files originally derived from alumnium, link to the source commit SHA.
- **Header comment** on each forked file: `/* Originally from alumnium-hq/alumnium (MIT). Modified for rolepod-mcp. */`
- **README.md** acknowledgements section.
- **CHANGELOG.md** v0.1 entry credits alumnium.

### Drift management

- Maintain a `UPSTREAM_TRACKING.md` listing the alumnium commit SHA we forked from and the date.
- Quarterly: review alumnium's commit log between the tracked SHA and `HEAD`. Cherry-pick driver/AT bug fixes that apply to us. Skip LLM-layer commits.
- We do **not** commit to staying current. We commit to staying *correct*.

## Unified A11y tree shape

Each engine's AT-tree extractor returns its native format. The engine layer then runs it through `engine/a11y/normalize.ts` to produce the unified `A11ySnapshot` shape consumed by tools.

```ts
type A11ySnapshot = {
  platform: 'web' | 'ios' | 'android'
  url_or_screen: string
  taken_at: string
  tree: A11yNode                 // see 03-tool-surface.md
  ref_index: Map<string, RefMeta>// internal: ref → selector/locator
  screenshot_buffer?: Buffer
}

type RefMeta =
  | { kind: 'css'; selector: string }
  | { kind: 'xpath'; expression: string }
  | { kind: 'mobile'; predicate: string }
```

`ref_index` is internal — never sent to the Lead. It's how the engine resolves `click(ref="e7")` back to a real locator.

## Locator strategy per platform

| Platform | Primary locator | Fallback |
|---|---|---|
| Chromium (web) | CSS via Playwright `locator()` | XPath |
| Firefox/WebKit (web) | Same as Chromium | XPath |
| iOS (XCUITest) | Predicate string | Accessibility ID, class chain |
| Android (UIAutomator2) | UiSelector | resource-id, content-desc |

The agent never sees these. It only sees `ref="e7"`.

## Snapshot freshness rules

- A `browser_snapshot` returns a tree whose refs are stable for **that snapshot only**.
- Any state-changing call (`click`, `type`, `key`, `scroll`, `navigate`, `wait_for`) **invalidates** all prior refs for that session.
- After invalidation, the next call must either be a fresh `browser_snapshot` or a composite tool that snapshots internally.
- Calling a stale ref returns a structured error: `{ error: "stale_ref", session_id, ref, last_valid_snapshot_at }`.

This is the most common Lead-side bug pattern (using a ref after an action mutates the page). The rule is documented and enforced by error, not by silent failure.

## Session lifecycle

- `browser_open` creates a session and registers it in `SessionRegistry` keyed by `session_id`.
- A session is closed by:
  - explicit `browser_close`
  - `verify_ui_flow` (any mode) / `audit_a11y` / etc. with `close_on_finish: true` (default)
  - idle timeout (default 5 min, configurable via `--idle-timeout`)
  - server shutdown
- Open sessions at shutdown are closed gracefully.

## Engine swap mechanism (config)

```bash
# Default (web → playwright):
npx rolepod-mcp

# Force selenium for web:
ROLEPOD_MCP_WEB_ENGINE=selenium npx rolepod-mcp

# Future: swap to a new engine entirely
ROLEPOD_MCP_WEB_ENGINE=chromedevtools npx rolepod-mcp
```

The factory in `src/engine/factory.ts` reads env once at startup. There is no per-tool override — engine choice is a server-level decision.

## What lives in the engine layer vs the tool layer

| Concern | Engine | Tool |
|---|---|---|
| Driver instantiation | ✅ | ❌ |
| AT-tree extraction | ✅ | ❌ |
| Ref resolution | ✅ | ❌ |
| Atomic action dispatch | ✅ | ❌ |
| Multi-step orchestration | ❌ | ✅ |
| Artifact saving | ❌ | ✅ (via ArtifactStore) |
| Snapshot caching for composites | ❌ | ✅ |
| Replay bundling | ❌ | ✅ |
| Schema validation | ❌ | ✅ |

This split is enforced by the `Engine` interface having no methods beyond primitive actions.
