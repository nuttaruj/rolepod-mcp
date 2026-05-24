import { UnknownSessionError, UnsupportedPlatformError } from "../util/errors.js";
import { log } from "../util/log.js";
import type { Engine, OpenOptions, Platform, Session } from "../engine/Engine.js";

/**
 * Routes sessions to the correct engine and enforces idle-timeout cleanup.
 *
 * v0.1: only PlaywrightEngine is wired up, so every `platform: 'web'`
 * request goes there. AppiumEngine (v0.3) will register against the
 * `ios`/`android` platform keys without touching tool code.
 */
export class SessionRegistry {
  private readonly enginesByPlatform = new Map<Platform, Engine>();
  private readonly engineBySession = new Map<string, Engine>();
  private readonly lastActivity = new Map<string, number>();
  private readonly idleTimeoutMs: number;
  private idleTimer: NodeJS.Timeout | null = null;

  constructor(opts: { idleTimeoutMs?: number } = {}) {
    this.idleTimeoutMs = opts.idleTimeoutMs ?? 5 * 60 * 1000;
  }

  /** Register an engine as the handler for a given platform. */
  register(platform: Platform, engine: Engine): void {
    this.enginesByPlatform.set(platform, engine);
  }

  async open(opts: OpenOptions): Promise<Session> {
    const engine = this.enginesByPlatform.get(opts.platform);
    if (!engine) throw new UnsupportedPlatformError(opts.platform);
    const session = await engine.open(opts);
    this.engineBySession.set(session.id, engine);
    this.touch(session.id);
    this.ensureIdleSweep();
    return session;
  }

  engineFor(sessionId: string): Engine {
    const engine = this.engineBySession.get(sessionId);
    if (!engine) throw new UnknownSessionError(sessionId);
    this.touch(sessionId);
    return engine;
  }

  async close(session: Session): Promise<void> {
    const engine = this.engineBySession.get(session.id);
    if (!engine) throw new UnknownSessionError(session.id);
    await engine.close(session);
    this.engineBySession.delete(session.id);
    this.lastActivity.delete(session.id);
  }

  async shutdown(): Promise<void> {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
    const closes: Array<Promise<void>> = [];
    for (const [sessionId, engine] of this.engineBySession) {
      const platform = this.platformFor(sessionId);
      closes.push(
        engine
          .close({ id: sessionId, platform })
          .catch((err: unknown) =>
            log.warn("shutdown close failed", { sessionId, err: String(err) }),
          ),
      );
    }
    await Promise.all(closes);
    this.engineBySession.clear();
    this.lastActivity.clear();
  }

  private touch(sessionId: string): void {
    this.lastActivity.set(sessionId, Date.now());
  }

  private platformFor(sessionId: string): Platform {
    // The engine ids map 1:1 to platforms in v0.1: playwright→web.
    // When AppiumEngine lands the registry will track this per-session.
    const engine = this.engineBySession.get(sessionId);
    if (engine?.id === "appium") {
      // best-effort — v0.3 will record real platform at open() time
      return "android";
    }
    return "web";
  }

  private ensureIdleSweep(): void {
    if (this.idleTimer || this.idleTimeoutMs <= 0) return;
    const interval = Math.max(30_000, Math.floor(this.idleTimeoutMs / 4));
    this.idleTimer = setInterval(() => {
      const cutoff = Date.now() - this.idleTimeoutMs;
      for (const [sessionId, lastSeen] of this.lastActivity) {
        if (lastSeen < cutoff) {
          const engine = this.engineBySession.get(sessionId);
          if (!engine) {
            this.lastActivity.delete(sessionId);
            continue;
          }
          log.info("idle session sweep — closing", { sessionId });
          engine
            .close({ id: sessionId, platform: this.platformFor(sessionId) })
            .catch((err: unknown) =>
              log.warn("idle close failed", { sessionId, err: String(err) }),
            )
            .finally(() => {
              this.engineBySession.delete(sessionId);
              this.lastActivity.delete(sessionId);
            });
        }
      }
    }, interval);
    this.idleTimer.unref();
  }
}
