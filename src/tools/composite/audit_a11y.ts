import AxeBuilder from "@axe-core/playwright";
import { PlaywrightEngine } from "../../engine/PlaywrightEngine.js";
import {
  auditA11yShape,
  ToolNames,
  type AuditA11yInput,
} from "../../schema/tools.js";
import { RolepodMcpError } from "../../util/errors.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

const TAGS_BY_LEVEL: Record<AuditA11yInput["level"], string[]> = {
  "wcag-a": ["wcag2a", "wcag21a"],
  "wcag-aa": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  "wcag-aaa": [
    "wcag2a",
    "wcag2aa",
    "wcag2aaa",
    "wcag21a",
    "wcag21aa",
    "wcag21aaa",
  ],
};

const AXE_TO_SEVERITY: Record<string, "critical" | "serious" | "moderate" | "minor"> = {
  critical: "critical",
  serious: "serious",
  moderate: "moderate",
  minor: "minor",
};

export const auditA11yTool: ToolModule<typeof auditA11yShape> = {
  name: ToolNames.auditA11y,
  description:
    "Run an accessibility audit on the page using axe-core. Returns issues grouped by severity with WCAG references and fix suggestions. v0.2: scope='page' only.",
  inputShape: auditA11yShape,
  build(ctx) {
    return safeHandler(async (args: AuditA11yInput) => {
      const { runId, runDir } = await ctx.store.startRun("audit");
      const session = await ctx.registry.open(args.open);
      const engine = ctx.registry.engineFor(session.id);
      if (!(engine instanceof PlaywrightEngine)) {
        throw new RolepodMcpError(
          "unsupported_engine",
          "audit_a11y currently requires PlaywrightEngine (mobile a11y audit lands later).",
        );
      }
      const page = engine.getPageForSession(session.id);

      let reportPath: string | undefined;
      let issues: Array<Record<string, unknown>> = [];
      let scopeTagged = false;
      try {
        // Tag the scope element so axe-core can include it via CSS.
        if (args.scope !== "page") {
          // refresh refIndex so the supplied ref is meaningful
          await engine.snapshot({ id: session.id, platform: "web" });
          const ref = args.scope.ref;
          const locator = page.locator(`aria-ref=${ref}`);
          if ((await locator.count()) === 0) {
            throw new RolepodMcpError(
              "unknown_ref",
              `Ref "${ref}" not found in the current snapshot.`,
              { session_id: session.id, ref },
            );
          }
          await locator
            .first()
            .evaluate((el) => el.setAttribute("data-rolepod-axe-scope", "true"));
          scopeTagged = true;
        }

        const builder = new AxeBuilder({ page }).withTags(TAGS_BY_LEVEL[args.level]);
        if (scopeTagged) builder.include("[data-rolepod-axe-scope]");
        const results = await builder.analyze();
        issues = results.violations.flatMap((v) =>
          v.nodes.map((n, idx) => ({
            wcag_ref: pickWcagRef(v.tags) ?? v.id,
            severity: AXE_TO_SEVERITY[v.impact ?? "minor"] ?? "minor",
            ref: `${v.id}#${idx}`,
            description: v.help,
            fix_suggestion: v.helpUrl,
            target: n.target.join(" "),
          })),
        );

        const payload = {
          run_id: runId,
          level: args.level,
          counts: countBySeverity(issues),
          issues,
        };
        if (args.report_format === "markdown") {
          reportPath = await ctx.store.writeReport(
            runDir,
            "report.md",
            renderMarkdown(payload),
          );
        } else {
          reportPath = await ctx.store.writeReport(
            runDir,
            "report.json",
            JSON.stringify(payload, null, 2),
          );
        }
      } finally {
        if (scopeTagged) {
          await page
            .locator("[data-rolepod-axe-scope]")
            .first()
            .evaluate((el) => el.removeAttribute("data-rolepod-axe-scope"))
            .catch(() => undefined);
        }
        if (args.close_on_finish) {
          await ctx.registry.close(session).catch(() => undefined);
        }
      }

      return ok({
        run_id: runId,
        counts: countBySeverity(issues),
        issues,
        report_path: reportPath,
      });
    });
  },
};

function pickWcagRef(tags: string[]): string | undefined {
  return tags.find((t) => /^wcag\d/.test(t));
}

function countBySeverity(
  issues: Array<Record<string, unknown>>,
): Record<string, number> {
  const out: Record<string, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };
  for (const i of issues) {
    const s = String(i.severity);
    out[s] = (out[s] ?? 0) + 1;
  }
  return out;
}

function renderMarkdown(p: {
  run_id: string;
  level: string;
  counts: Record<string, number>;
  issues: Array<Record<string, unknown>>;
}): string {
  const header = `# A11y audit — ${p.run_id}\n\nLevel: \`${p.level}\`\n\n## Counts\n\n- critical: ${p.counts.critical}\n- serious: ${p.counts.serious}\n- moderate: ${p.counts.moderate}\n- minor: ${p.counts.minor}\n\n## Issues\n\n`;
  const body = p.issues
    .map(
      (i) =>
        `### ${i.severity} — ${i.description}\n\n- WCAG: ${i.wcag_ref}\n- Target: \`${i.target}\`\n- Fix: ${i.fix_suggestion}\n`,
    )
    .join("\n");
  return header + body;
}
