import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { log } from "../util/log.js";

/**
 * Writes artifacts under `./.rolepod-mcp/artifacts/{run_id}/` (D-026).
 *
 * v0.1 emits two formats: PNG screenshots and a JSON replay bundle. Future
 * milestones extend the format set (HAR, console log, a11y tree, video).
 */
export type ReplayStep = Record<string, unknown>;

export type ReplayBundle = {
  version: 1;
  run_id: string;
  recorded_at: string;
  open: Record<string, unknown>;
  steps: ReplayStep[];
  expect: ReplayStep[];
};

export type ArtifactPaths = {
  screenshots: string[];
  replay_bundle?: string;
};

export class ArtifactStore {
  readonly rootDir: string;

  constructor(opts: { rootDir?: string } = {}) {
    this.rootDir = opts.rootDir ?? resolve(process.cwd(), ".rolepod-mcp", "artifacts");
  }

  /** Allocate a fresh run id and ensure its directory exists. */
  async startRun(prefix = "run"): Promise<{ runId: string; runDir: string }> {
    const runId = `${prefix}_${this.timestampSlug()}_${randomUUID().slice(0, 8)}`;
    const runDir = resolve(this.rootDir, runId);
    await mkdir(runDir, { recursive: true });
    log.debug("artifact run started", { run_id: runId, dir: runDir });
    return { runId, runDir };
  }

  async writeScreenshot(
    runDir: string,
    buf: Buffer,
    name: string,
  ): Promise<string> {
    const path = resolve(runDir, `${name}.png`);
    await writeFile(path, buf);
    return path;
  }

  async writeReplayBundle(runDir: string, bundle: ReplayBundle): Promise<string> {
    const path = resolve(runDir, "replay.json");
    await writeFile(path, JSON.stringify(bundle, null, 2), "utf8");
    return path;
  }

  private timestampSlug(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${d.getUTCFullYear()}` +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      "T" +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds())
    );
  }
}
