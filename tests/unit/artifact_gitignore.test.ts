import { mkdirSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ArtifactStore } from "../../src/artifact/ArtifactStore.js";

/**
 * Field finding #6 — uiproof writes run artifacts into the consumer's repo
 * (`.rolepod-uiproof/artifacts/` standalone, `.rolepod/evidence/` with-parent).
 * Without a self-ignoring `.gitignore`, a `git add -A` swept those PNGs +
 * manifests into a commit by accident. ArtifactStore now drops `*` on first
 * write — scoped to the evidence root only (baselines stay commit-able).
 */
describe("ArtifactStore self-gitignore (field finding #6)", () => {
  let root: string | null = null;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = null;
  });

  it("drops a self-ignoring .gitignore at the evidence root on first run", async () => {
    root = mkdtempSync(join(tmpdir(), "rolepod-uiproof-gi-"));
    const evidenceRoot = join(root, "artifacts");
    const store = new ArtifactStore({ rootDir: evidenceRoot, mode: "standalone" });

    const gitignore = join(evidenceRoot, ".gitignore");
    expect(existsSync(gitignore)).toBe(false); // nothing written until first run

    await store.startRun("snap");

    expect(existsSync(gitignore)).toBe(true);
    expect(readFileSync(gitignore, "utf8")).toBe("*\n");
  });

  it("does not clobber a pre-existing .gitignore", async () => {
    root = mkdtempSync(join(tmpdir(), "rolepod-uiproof-gi-"));
    const evidenceRoot = join(root, "artifacts");
    mkdirSync(evidenceRoot, { recursive: true });
    const gitignore = join(evidenceRoot, ".gitignore");
    writeFileSync(gitignore, "# custom\nfoo\n", "utf8");

    const store = new ArtifactStore({ rootDir: evidenceRoot, mode: "standalone" });
    await store.startRun("snap");

    expect(readFileSync(gitignore, "utf8")).toBe("# custom\nfoo\n"); // untouched
  });

  it("writes the .gitignore only once across many runs", async () => {
    root = mkdtempSync(join(tmpdir(), "rolepod-uiproof-gi-"));
    const evidenceRoot = join(root, "artifacts");
    const store = new ArtifactStore({ rootDir: evidenceRoot, mode: "standalone" });

    await store.startRun("snap");
    const gitignore = join(evidenceRoot, ".gitignore");
    // Overwrite with a sentinel; a second run must NOT rewrite it.
    writeFileSync(gitignore, "sentinel\n", "utf8");
    await store.startRun("snap");

    expect(readFileSync(gitignore, "utf8")).toBe("sentinel\n");
  });
});
