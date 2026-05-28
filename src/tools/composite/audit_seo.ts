import { PlaywrightEngine } from "../../engine/PlaywrightEngine.js";
import type { OpenOptions, Session } from "../../engine/Engine.js";
import {
  auditSeoShape,
  ToolNames,
  type AuditSeoInput,
} from "../../schema/tools.js";
import { RolepodMcpError } from "../../util/errors.js";
import {
  writeManifest,
  type ManifestArtifact,
  type ManifestStatus,
} from "../../util/manifest.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

type Severity = "critical" | "high" | "medium" | "low";

type Finding = {
  check: string;
  severity: Severity;
  message: string;
  evidence?: string;
};

type SeoSnapshot = {
  title: string | null;
  meta_description: string | null;
  h1_texts: string[];
  html_lang: string | null;
  viewport: string | null;
  canonical: string | null;
  robots: string | null;
  og_tags: Record<string, string>;
  twitter_tags: Record<string, string>;
  json_ld: Array<{ raw: string; parsed: unknown; parse_error?: string }>;
  hreflang: Array<{ lang: string | null; href: string | null }>;
  favicon: string | null;
};

const DEFAULT_CHECKS: AuditSeoInput["checks"] = [
  "title",
  "meta_description",
  "h1",
  "lang",
  "viewport",
  "canonical",
  "robots",
  "og_tags",
  "twitter_tags",
  "json_ld",
  "hreflang",
  "favicon",
];

export const auditSeoTool: ToolModule<typeof auditSeoShape> = {
  name: ToolNames.auditSeo,
  description:
    "Audit on-page SEO by inspecting the rendered DOM. Checks title, meta description, h1 structure, html lang, viewport, canonical, robots, OpenGraph + Twitter Card tags, JSON-LD validity, hreflang, and favicon. Returns findings grouped by severity.",
  inputShape: auditSeoShape,
  build(ctx) {
    return safeHandler(async (args: AuditSeoInput) => {
      const startedAt = new Date().toISOString();
      const checks = new Set(args.checks ?? DEFAULT_CHECKS);

      const { runId, runDir, skill } = await ctx.store.startRun("audit_seo", {
        skill: "audit-seo",
      });

      const openOpts: OpenOptions = {
        platform: "web",
        url: args.url,
        browser: args.browser ?? "chromium",
        viewport: args.viewport,
      };
      const session = await ctx.registry.open(openOpts);
      const sessionHandle: Session = { id: session.id, platform: session.platform };
      const engine = ctx.registry.engineFor(session.id);
      if (!(engine instanceof PlaywrightEngine)) {
        throw new RolepodMcpError(
          "unsupported_engine",
          "audit_seo requires PlaywrightEngine.",
        );
      }

      let findings: Finding[] = [];
      let snapshot: SeoSnapshot | null = null;
      try {
        const page = engine.getPageForSession(session.id);
        await page.waitForLoadState("domcontentloaded");
        snapshot = await page.evaluate(extractSeoSnapshot);
        findings = runSeoRules(snapshot, checks);
      } finally {
        if (args.close_on_finish) {
          await ctx.registry.close(session).catch(() => undefined);
        }
        // Engine handle no longer needed once data is extracted.
        void sessionHandle;
      }

      const counts = countBySeverity(findings);
      const status = seoStatus(counts);

      const payload = {
        run_id: runId,
        url: args.url,
        checks: [...checks],
        counts,
        findings,
        snapshot,
      };

      const reportPath = await ctx.store.writeReport(
        runDir,
        "seo-report.json",
        JSON.stringify(payload, null, 2),
      );
      let markdownPath: string | undefined;
      if (args.report_format === "markdown") {
        markdownPath = await ctx.store.writeReport(
          runDir,
          "seo-report.md",
          renderMarkdown(payload),
        );
      }

      const artifacts: ManifestArtifact[] = [
        { type: "seo-report", path: reportPath },
        ...(markdownPath ? [{ type: "seo-report-md", path: markdownPath }] : []),
      ];
      const manifestPath = await writeManifest({
        runDir,
        skill,
        phase: "verify",
        status,
        summary: buildSummary(counts, status),
        startedAt,
        finishedAt: new Date().toISOString(),
        artifacts,
        metadata: {
          url: args.url,
          counts,
          checks: [...checks],
        },
      });

      return ok({
        run_id: runId,
        url: args.url,
        counts,
        findings,
        status,
        report_path: reportPath,
        ...(markdownPath ? { markdown_path: markdownPath } : {}),
        ...(manifestPath ? { manifest: manifestPath } : {}),
      });
    });
  },
};

/**
 * Runs inside the page context. Plain-DOM extraction — keeps deps zero
 * on the page side and keeps the SEO snapshot reproducible from any
 * Playwright-driven session.
 */
function extractSeoSnapshot(): SeoSnapshot {
  const text = (sel: string) =>
    document.querySelector(sel)?.textContent?.trim() ?? null;
  const attr = (sel: string, name: string) =>
    document.querySelector(sel)?.getAttribute(name) ?? null;
  const meta = (selector: string) =>
    (document.querySelector(`meta[${selector}]`) as HTMLMetaElement | null)?.content?.trim() ?? null;

  const og: Record<string, string> = {};
  for (const el of Array.from(document.querySelectorAll('meta[property^="og:"]'))) {
    const prop = el.getAttribute("property");
    const content = (el as HTMLMetaElement).content;
    if (prop && content) og[prop] = content;
  }
  const tw: Record<string, string> = {};
  for (const el of Array.from(document.querySelectorAll('meta[name^="twitter:"]'))) {
    const name = el.getAttribute("name");
    const content = (el as HTMLMetaElement).content;
    if (name && content) tw[name] = content;
  }

  const ld: Array<{ raw: string; parsed: unknown; parse_error?: string }> = [];
  for (const el of Array.from(
    document.querySelectorAll('script[type="application/ld+json"]'),
  )) {
    const raw = (el.textContent ?? "").trim();
    if (!raw) continue;
    try {
      ld.push({ raw, parsed: JSON.parse(raw) });
    } catch (err) {
      ld.push({ raw, parsed: null, parse_error: (err as Error).message });
    }
  }

  const hreflang: Array<{ lang: string | null; href: string | null }> = [];
  for (const el of Array.from(
    document.querySelectorAll('link[rel="alternate"][hreflang]'),
  )) {
    hreflang.push({
      lang: el.getAttribute("hreflang"),
      href: el.getAttribute("href"),
    });
  }

  return {
    title: text("title"),
    meta_description: meta('name="description"'),
    h1_texts: Array.from(document.querySelectorAll("h1")).map(
      (el) => el.textContent?.trim() ?? "",
    ),
    html_lang: document.documentElement.getAttribute("lang"),
    viewport: meta('name="viewport"'),
    canonical: attr('link[rel="canonical"]', "href"),
    robots: meta('name="robots"'),
    og_tags: og,
    twitter_tags: tw,
    json_ld: ld,
    hreflang,
    favicon:
      attr('link[rel="icon"]', "href") ??
      attr('link[rel="shortcut icon"]', "href"),
  };
}

function runSeoRules(snap: SeoSnapshot, checks: Set<string>): Finding[] {
  const out: Finding[] = [];

  if (checks.has("title")) {
    if (!snap.title) {
      out.push({ check: "title", severity: "critical", message: "<title> missing or empty" });
    } else {
      const len = snap.title.length;
      if (len < 10) {
        out.push({
          check: "title",
          severity: "high",
          message: `<title> very short (${len} chars; aim 10-70)`,
          evidence: snap.title,
        });
      } else if (len > 70) {
        out.push({
          check: "title",
          severity: "high",
          message: `<title> too long (${len} chars; aim 10-70)`,
          evidence: snap.title,
        });
      }
    }
  }

  if (checks.has("meta_description")) {
    if (!snap.meta_description) {
      out.push({
        check: "meta_description",
        severity: "critical",
        message: '<meta name="description"> missing',
      });
    } else {
      const len = snap.meta_description.length;
      if (len < 50 || len > 160) {
        out.push({
          check: "meta_description",
          severity: "high",
          message: `meta description length ${len} (aim 50-160)`,
          evidence: snap.meta_description,
        });
      }
    }
  }

  if (checks.has("h1")) {
    if (snap.h1_texts.length === 0) {
      out.push({ check: "h1", severity: "critical", message: "No <h1> on page" });
    } else if (snap.h1_texts.length > 1) {
      out.push({
        check: "h1",
        severity: "high",
        message: `${snap.h1_texts.length} <h1> elements (expected 1)`,
        evidence: snap.h1_texts.join(" | "),
      });
    }
  }

  if (checks.has("lang") && !snap.html_lang) {
    out.push({
      check: "lang",
      severity: "critical",
      message: '<html lang="..."> missing',
    });
  }

  if (checks.has("viewport")) {
    if (!snap.viewport) {
      out.push({
        check: "viewport",
        severity: "critical",
        message: '<meta name="viewport"> missing',
      });
    } else {
      if (/user-scalable=no/i.test(snap.viewport)) {
        out.push({
          check: "viewport",
          severity: "critical",
          message: "viewport disables user scaling (user-scalable=no)",
          evidence: snap.viewport,
        });
      }
      if (!/width=device-width/i.test(snap.viewport)) {
        out.push({
          check: "viewport",
          severity: "high",
          message: "viewport missing width=device-width",
          evidence: snap.viewport,
        });
      }
    }
  }

  if (checks.has("canonical") && !snap.canonical) {
    out.push({
      check: "canonical",
      severity: "high",
      message: '<link rel="canonical"> absent',
    });
  }

  if (checks.has("robots") && snap.robots) {
    if (/noindex/i.test(snap.robots)) {
      out.push({
        check: "robots",
        severity: "critical",
        message: "meta robots declares noindex",
        evidence: snap.robots,
      });
    }
  }

  if (checks.has("og_tags")) {
    if (!snap.og_tags["og:title"]) {
      out.push({
        check: "og_tags",
        severity: "high",
        message: "og:title missing",
      });
    }
    if (!snap.og_tags["og:image"]) {
      out.push({
        check: "og_tags",
        severity: "high",
        message: "og:image missing",
      });
    }
  }

  if (checks.has("twitter_tags") && !snap.twitter_tags["twitter:card"]) {
    out.push({
      check: "twitter_tags",
      severity: "medium",
      message: "twitter:card missing",
    });
  }

  if (checks.has("json_ld")) {
    for (const entry of snap.json_ld) {
      if (entry.parse_error) {
        out.push({
          check: "json_ld",
          severity: "critical",
          message: `JSON-LD parse error: ${entry.parse_error}`,
          evidence: entry.raw.slice(0, 200),
        });
        continue;
      }
      const parsed = entry.parsed as { "@type"?: unknown } | null;
      const type = parsed && typeof parsed === "object" ? parsed["@type"] : undefined;
      if (!type) {
        out.push({
          check: "json_ld",
          severity: "high",
          message: "JSON-LD entry missing @type",
        });
      }
    }
  }

  if (checks.has("favicon") && !snap.favicon) {
    out.push({ check: "favicon", severity: "low", message: "favicon missing" });
  }

  // hreflang has no "missing" rule — it is optional. We only flag mismatched
  // shape (no href, no lang) when entries exist.
  if (checks.has("hreflang")) {
    for (const h of snap.hreflang) {
      if (!h.lang || !h.href) {
        out.push({
          check: "hreflang",
          severity: "medium",
          message: "hreflang entry missing lang or href",
          evidence: JSON.stringify(h),
        });
      }
    }
  }

  return out;
}

function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const out: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) out[f.severity] += 1;
  return out;
}

function seoStatus(counts: Record<Severity, number>): ManifestStatus {
  if (counts.critical + counts.high > 0) return "fail";
  if (counts.medium + counts.low > 0) return "warn";
  return "pass";
}

function buildSummary(
  counts: Record<Severity, number>,
  status: ManifestStatus,
): string {
  if (status === "pass") return "SEO: 0 issues";
  return `SEO: critical=${counts.critical}, high=${counts.high}, medium=${counts.medium}, low=${counts.low}`;
}

function renderMarkdown(p: {
  run_id: string;
  url: string;
  counts: Record<Severity, number>;
  findings: Finding[];
}): string {
  const header = `# SEO audit — ${p.run_id}\n\nURL: ${p.url}\n\n## Counts\n\n- critical: ${p.counts.critical}\n- high: ${p.counts.high}\n- medium: ${p.counts.medium}\n- low: ${p.counts.low}\n\n## Findings\n\n`;
  if (p.findings.length === 0) {
    return `${header}_No issues found._\n`;
  }
  const body = p.findings
    .map(
      (f) =>
        `### ${f.severity} — ${f.check}\n\n${f.message}${f.evidence ? `\n\n\`\`\`\n${f.evidence}\n\`\`\`` : ""}\n`,
    )
    .join("\n");
  return header + body;
}
