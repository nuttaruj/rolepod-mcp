import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { log } from "../util/log.js";

/**
 * Writes run artifacts. In **standalone** mode (default) — and in v0.4 and
 * earlier — runs live under `./.rolepod-uiproof/artifacts/{prefix}_{ts}_{uuid}/`.
 *
 * In **with-parent** mode — activated automatically when the env var
 * `ROLEPOD_PARENT=1` is set by the parent `rolepod` plugin's SessionStart
 * hook — runs live under `./.rolepod/evidence/{ts}-rolepod-uiproof-{skill}/`,
 * per the Extension Protocol v1 evidence-path convention. Parent's
 * `check-work` skill aggregates manifest.json files from this directory.
 *
 * Baselines for `visual_diff` always live in `./.rolepod-uiproof/baselines/`
 * regardless of mode — they are user-curated configuration, not per-run
 * evidence.
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

export type ArtifactMode = "standalone" | "with-parent";

export type StartRunOptions = {
  /**
   * Skill name as it appears in marketplace (`verify-ui`, `audit-a11y`,
   * `visual-diff`, `scaffold-e2e`, `check-errors`). REQUIRED when emitting
   * a manifest.json (Extension Protocol v1) so parent's `check-work` can
   * route artifacts to the right phase.
   *
   * In `with-parent` mode the run dirname is derived from this field; if
   * omitted the `prefix` argument is used as a fallback (legacy).
   */
  skill?: string;
};

export type StartRunResult = {
  runId: string;
  runDir: string;
  skill: string;
  mode: ArtifactMode;
};

export class ArtifactStore {
  readonly rootDir: string;
  readonly mode: ArtifactMode;
  private readonly baselineRoot: string;

  constructor(
    opts: { rootDir?: string; mode?: ArtifactMode } = {},
  ) {
    const detectedParent = process.env.ROLEPOD_PARENT === "1";
    this.mode = opts.mode ?? (detectedParent ? "with-parent" : "standalone");

    if (opts.rootDir !== undefined) {
      this.rootDir = opts.rootDir;
    } else if (this.mode === "with-parent") {
      this.rootDir = resolve(process.cwd(), ".rolepod", "evidence");
    } else {
      this.rootDir = resolve(process.cwd(), ".rolepod-uiproof", "artifacts");
    }

    // Baselines are config, not evidence — always live in the standalone
    // location so visual_diff sees the same set across modes.
    this.baselineRoot = resolve(process.cwd(), ".rolepod-uiproof", "baselines");
  }

  /**
   * Allocate a fresh run dir and ensure it exists.
   *
   * - standalone: `./.rolepod-uiproof/artifacts/{prefix}_{ts}_{uuid}/`
   * - with-parent: `./.rolepod/evidence/{ts}-rolepod-uiproof-{skill}/`
   *
   * `prefix` is preserved for back-compat with v0.5 callers; new callers
   * should also pass `opts.skill` so the with-parent path can be derived
   * unambiguously and the manifest can be emitted with the canonical
   * skill name.
   */
  async startRun(
    prefix = "run",
    opts: StartRunOptions = {},
  ): Promise<StartRunResult> {
    const ts = this.timestampSlug();
    const skill = opts.skill ?? prefix;

    let runId: string;
    if (this.mode === "with-parent") {
      // Parent expects a flat, sortable dirname. Append a short uuid only
      // when two runs of the same skill could collide within one second.
      runId = `${ts}-rolepod-uiproof-${skill}`;
    } else {
      runId = `${prefix}_${ts}_${randomUUID().slice(0, 8)}`;
    }

    const runDir = resolve(this.rootDir, runId);
    await mkdir(runDir, { recursive: true });
    log.debug("artifact run started", {
      run_id: runId,
      dir: runDir,
      mode: this.mode,
      skill,
    });
    return { runId, runDir, skill, mode: this.mode };
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

  async writeReplayBundle(
    runDir: string,
    bundle: ReplayBundle,
    name = "replay.json",
  ): Promise<string> {
    const path = resolve(runDir, name);
    await writeFile(path, JSON.stringify(bundle, null, 2), "utf8");
    return path;
  }

  async writeReport(runDir: string, name: string, body: string): Promise<string> {
    const path = resolve(runDir, name);
    await writeFile(path, body, "utf8");
    return path;
  }

  async writeBytes(runDir: string, name: string, buf: Buffer): Promise<string> {
    const path = resolve(runDir, name);
    await writeFile(path, buf);
    return path;
  }

  async ensureDir(absDir: string): Promise<string> {
    await mkdir(absDir, { recursive: true });
    return absDir;
  }

  /** Root for stored visual baselines: `./.rolepod-uiproof/baselines/`. */
  get baselineDir(): string {
    return this.baselineRoot;
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
