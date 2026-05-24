import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ToolNames } from "../../src/schema/tools.js";

/**
 * Skill lint — enforces the v0.2 contract from brief/11-plugin-skills.md.
 *
 * Shipped skills MUST:
 * - have YAML frontmatter with a `description` field
 * - call exactly one `rolepod_*` tool that exists in `ToolNames`
 * - NOT contain a "fallback" / "backend resolution" section (D-024)
 */

const SKILLS_DIR = resolve(__dirname, "..", "..", "skills");
const KNOWN_TOOLS = new Set<string>(Object.values(ToolNames));

const skillDirs = readdirSync(SKILLS_DIR).filter((d) => {
  const full = resolve(SKILLS_DIR, d);
  return statSync(full).isDirectory();
});

describe("skill lint", () => {
  it("finds at least one shipped skill", () => {
    expect(skillDirs.length).toBeGreaterThan(0);
  });

  for (const dir of skillDirs) {
    describe(dir, () => {
      const path = resolve(SKILLS_DIR, dir, "SKILL.md");
      const raw = readFileSync(path, "utf8");

      it("has YAML frontmatter with description", () => {
        expect(raw.startsWith("---")).toBe(true);
        const fm = raw.slice(3, raw.indexOf("\n---", 3));
        expect(fm).toMatch(/^description:\s+\S/m);
      });

      it("references exactly one rolepod_* tool that exists", () => {
        const referenced = new Set(
          [...raw.matchAll(/`?(rolepod_[a-z0-9_]+)`?/g)].map((m) => m[1]!),
        );
        expect(
          referenced.size,
          `Skill must reference exactly one rolepod_* tool, found ${referenced.size}: ${[...referenced].join(", ")}`,
        ).toBe(1);
        const [only] = referenced;
        expect(KNOWN_TOOLS.has(only!), `${only} is not in ToolNames`).toBe(true);
      });

      it("contains no fallback chain (D-024)", () => {
        const banned = [
          /##\s+fallback/i,
          /##\s+backend resolution/i,
          /try (playwright|chrome-devtools) mcp/i,
          /fall back to (playwright|chrome-devtools|axe-core) mcp/i,
        ];
        for (const re of banned) {
          expect(
            re.test(raw),
            `Skill ${dir} contains a banned fallback marker /${re.source}/`,
          ).toBe(false);
        }
      });

      it("has the canonical body sections", () => {
        for (const section of [
          "When to use",
          "When NOT to use",
          "Inputs",
          "Outputs",
          "Process",
          "If the tool is unavailable",
        ]) {
          expect(raw.includes(`## ${section}`)).toBe(true);
        }
      });
    });
  }
});
