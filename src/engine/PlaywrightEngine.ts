import { randomUUID } from "node:crypto";
import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
  type Locator,
} from "playwright";
import {
  RolepodMcpError,
  UnknownRefError,
  UnsupportedPlatformError,
} from "../util/errors.js";
import { log } from "../util/log.js";
import {
  parseAriaSnapshot,
  type RefMeta,
} from "./a11y/normalize.js";
import type {
  A11ySnapshot,
  Direction,
  Engine,
  OpenOptions,
  Session,
  WaitCondition,
} from "./Engine.js";

type WebSession = Session & {
  readonly platform: "web";
  readonly browser: Browser;
  readonly context: BrowserContext;
  readonly page: Page;
};

type SessionInternals = {
  session: WebSession;
  refIndex: Map<string, RefMeta>;
  /**
   * Monotonic generation number. Snapshot resets refs; any state-changing
   * call bumps the generation, invalidating prior refs per D-010.
   */
  snapshotGeneration: number;
  /** Generation at which the current refIndex was issued. */
  refGeneration: number;
  lastSnapshotAt: string | null;
};

/**
 * PlaywrightEngine — v0.1 web-only implementation backed by Playwright's
 * Chromium / Firefox / WebKit drivers and the built-in
 * `page.accessibility.snapshot()` API.
 *
 * The interface contract (Engine.ts) is shared with AppiumEngine and the
 * optional SeleniumEngine.
 */
export class PlaywrightEngine implements Engine {
  readonly id = "playwright" as const;

  private readonly sessions = new Map<string, SessionInternals>();

  async open(opts: OpenOptions): Promise<Session> {
    if (opts.platform !== "web") {
      throw new UnsupportedPlatformError(opts.platform);
    }

    const browserName = opts.browser ?? "chromium";
    const launcher =
      browserName === "firefox"
        ? firefox
        : browserName === "webkit"
          ? webkit
          : chromium;

    const headless = opts.headless ?? (process.env.CI ? true : false);
    const browser = await launcher.launch({ headless });

    const contextOptions: Parameters<typeof browser.newContext>[0] = {};
    if (opts.viewport) contextOptions.viewport = opts.viewport;
    if (opts.user_agent) contextOptions.userAgent = opts.user_agent;
    if (opts.locale) contextOptions.locale = opts.locale;

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    if (opts.url) {
      await page.goto(opts.url, { waitUntil: "domcontentloaded" });
    }

    const sessionId = randomUUID();
    const session: WebSession = {
      id: sessionId,
      platform: "web",
      browser,
      context,
      page,
    };
    this.sessions.set(sessionId, {
      session,
      refIndex: new Map(),
      snapshotGeneration: 0,
      refGeneration: -1,
      lastSnapshotAt: null,
    });
    log.info("session opened", {
      session_id: sessionId,
      browser: browserName,
      url: opts.url ?? null,
    });
    return { id: sessionId, platform: "web" };
  }

  async close(session: Session): Promise<void> {
    const s = this.requireSession(session.id);
    await s.session.context.close().catch((err: unknown) => {
      log.warn("context close failed", { session_id: session.id, err: String(err) });
    });
    await s.session.browser.close().catch((err: unknown) => {
      log.warn("browser close failed", { session_id: session.id, err: String(err) });
    });
    this.sessions.delete(session.id);
    log.info("session closed", { session_id: session.id });
  }

  async snapshot(
    session: Session,
    mode: "visible" | "full" = "visible",
  ): Promise<A11ySnapshot> {
    const s = this.requireSession(session.id);
    // Playwright 1.60 removed `page.accessibility`. The ai-mode aria
    // snapshot is the supported successor — it carries `[ref=eN]` markers
    // that the `aria-ref=` locator can resolve back to elements.
    const ariaYaml = await s.session.page.ariaSnapshot({ mode: "ai" });
    const { tree, refIndex } = parseAriaSnapshot(ariaYaml);
    void mode; // depth control will route here once we expose `depth` to callers.

    s.snapshotGeneration += 1;
    s.refGeneration = s.snapshotGeneration;
    s.refIndex = refIndex;
    s.lastSnapshotAt = new Date().toISOString();

    return {
      session_id: session.id,
      platform: "web",
      url_or_screen: s.session.page.url(),
      taken_at: s.lastSnapshotAt,
      tree,
    };
  }

  async click(
    session: Session,
    ref: string,
    opts?: { button?: "left" | "right" | "middle" },
  ): Promise<void> {
    const s = this.requireSession(session.id);
    const locator = this.resolveLocator(s, ref);
    await locator.click(opts?.button ? { button: opts.button } : undefined);
    this.invalidateRefs(s);
  }

  async type(
    session: Session,
    ref: string,
    text: string,
    opts?: { clearFirst?: boolean },
  ): Promise<void> {
    const s = this.requireSession(session.id);
    const locator = this.resolveLocator(s, ref);
    if (opts?.clearFirst) await locator.fill("");
    await locator.fill(text);
    this.invalidateRefs(s);
  }

  async key(session: Session, key: string): Promise<void> {
    const s = this.requireSession(session.id);
    await s.session.page.keyboard.press(key);
    this.invalidateRefs(s);
  }

  async scroll(
    session: Session,
    dir: Direction,
    amount = 400,
    ref?: string,
  ): Promise<void> {
    const s = this.requireSession(session.id);
    const dx = dir === "left" ? -amount : dir === "right" ? amount : 0;
    const dy = dir === "up" ? -amount : dir === "down" ? amount : 0;
    if (ref) {
      const locator = this.resolveLocator(s, ref);
      await locator.evaluate(
        (el, [x, y]) => el.scrollBy(x as number, y as number),
        [dx, dy],
      );
    } else {
      await s.session.page.mouse.wheel(dx, dy);
    }
    this.invalidateRefs(s);
  }

  async waitFor(
    session: Session,
    cond: WaitCondition,
    timeoutMs = 10_000,
  ): Promise<void> {
    const s = this.requireSession(session.id);
    const page = s.session.page;
    switch (cond.kind) {
      case "text_visible":
        await page
          .getByText(cond.text, { exact: false })
          .first()
          .waitFor({ state: "visible", timeout: timeoutMs });
        break;
      case "ref_exists":
        await page
          .getByRole("button", { name: cond.query })
          .first()
          .waitFor({ state: "attached", timeout: timeoutMs });
        break;
      case "url_matches":
        await page.waitForURL(new RegExp(cond.pattern), { timeout: timeoutMs });
        break;
      case "idle":
        await page.waitForLoadState("networkidle", { timeout: timeoutMs });
        await page.waitForTimeout(cond.ms);
        break;
    }
    this.invalidateRefs(s);
  }

  async screenshot(session: Session, fullPage = false): Promise<Buffer> {
    const s = this.requireSession(session.id);
    return s.session.page.screenshot({ fullPage });
  }

  async navigate(session: Session, url: string): Promise<void> {
    const s = this.requireSession(session.id);
    if (s.session.platform !== "web") {
      throw new UnsupportedPlatformError(s.session.platform);
    }
    await s.session.page.goto(url, { waitUntil: "domcontentloaded" });
    this.invalidateRefs(s);
  }

  /**
   * Composite-only escape hatch — exposes the raw Playwright Page so a
   * composite tool that genuinely needs page-level APIs (axe-core,
   * `getByText`, etc.) can use them without bloating the Engine interface
   * with web-specific verbs. Throws if the session is not web.
   */
  getPageForSession(sessionId: string): Page {
    const s = this.requireSession(sessionId);
    if (s.session.platform !== "web") {
      throw new UnsupportedPlatformError(s.session.platform);
    }
    return s.session.page;
  }

  /** Increment generation; the next ref-using call will see them as stale. */
  bumpGeneration(sessionId: string): void {
    const s = this.requireSession(sessionId);
    this.invalidateRefs(s);
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private requireSession(sessionId: string): SessionInternals {
    const s = this.sessions.get(sessionId);
    if (!s) {
      throw new RolepodMcpError(
        "unknown_session",
        `No open session with id "${sessionId}".`,
        { session_id: sessionId },
      );
    }
    return s;
  }

  private resolveLocator(s: SessionInternals, ref: string): Locator {
    if (s.refGeneration !== s.snapshotGeneration) {
      throw new RolepodMcpError(
        "stale_ref",
        `Ref "${ref}" is stale — re-snapshot before retrying.`,
        {
          session_id: s.session.id,
          ref,
          last_valid_snapshot_at: s.lastSnapshotAt,
        },
      );
    }
    const meta = s.refIndex.get(ref);
    if (!meta) throw new UnknownRefError(s.session.id, ref);
    // The synthetic refs (`s1`, `s2`, ...) we issue for the wrapper root
    // are not real elements; the Lead should never click them.
    if (meta.ref.startsWith("s")) {
      throw new UnknownRefError(s.session.id, ref);
    }
    return s.session.page.locator(`aria-ref=${meta.ref}`);
  }

  private invalidateRefs(s: SessionInternals): void {
    s.snapshotGeneration += 1;
  }

  /**
   * Test / shutdown helper. Closes every open session.
   */
  async shutdown(): Promise<void> {
    const ids = [...this.sessions.keys()];
    await Promise.all(
      ids.map((id) => this.close({ id, platform: "web" }).catch(() => undefined)),
    );
  }
}
