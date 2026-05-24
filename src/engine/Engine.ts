import type { A11yNode } from "../schema/tools.js";

/**
 * The single seam between rolepod-mcp's tool layer and any
 * browser/mobile automation backend. See brief/04-engine-layer.md.
 *
 * v0.1 ships PlaywrightEngine only. AppiumEngine (v0.3) and the optional
 * SeleniumEngine (v0.4) implement the same interface.
 */

export type Platform = "web" | "ios" | "android";
export type Direction = "up" | "down" | "left" | "right";

export type WaitCondition =
  | { kind: "text_visible"; text: string }
  | { kind: "ref_exists"; query: string }
  | { kind: "url_matches"; pattern: string }
  | { kind: "idle"; ms: number };

export type OpenOptions = {
  platform: Platform;
  url?: string;
  browser?: "chromium" | "firefox" | "webkit";
  viewport?: { width: number; height: number };
  headless?: boolean;
  user_agent?: string;
  locale?: string;
  // mobile forward-compat fields — ignored by web engines
  bundle_id?: string;
  device?: string;
  app_package?: string;
  app_activity?: string;
  emulator?: string;
};

/** Opaque session handle returned by `Engine.open`. */
export interface Session {
  readonly id: string;
  readonly platform: Platform;
}

export type A11ySnapshot = {
  session_id: string;
  platform: Platform;
  url_or_screen: string;
  taken_at: string;
  tree: A11yNode;
  /** Screenshot buffer captured alongside the snapshot, if requested. */
  screenshot?: Buffer;
};

export interface Engine {
  readonly id: "playwright" | "appium" | "selenium";

  open(opts: OpenOptions): Promise<Session>;
  close(session: Session): Promise<void>;

  snapshot(session: Session, mode?: "visible" | "full"): Promise<A11ySnapshot>;

  click(
    session: Session,
    ref: string,
    opts?: { button?: "left" | "right" | "middle" },
  ): Promise<void>;
  type(
    session: Session,
    ref: string,
    text: string,
    opts?: { clearFirst?: boolean },
  ): Promise<void>;
  key(session: Session, key: string): Promise<void>;
  scroll(
    session: Session,
    dir: Direction,
    amount?: number,
    ref?: string,
  ): Promise<void>;
  waitFor(
    session: Session,
    cond: WaitCondition,
    timeoutMs?: number,
  ): Promise<void>;
  screenshot(session: Session, fullPage?: boolean): Promise<Buffer>;
  /** Web-only. Throws `unsupported_platform` on mobile sessions. */
  navigate(session: Session, url: string): Promise<void>;
}
