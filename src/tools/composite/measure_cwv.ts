import { PlaywrightEngine } from "../../engine/PlaywrightEngine.js";
import {
  CWV_INJECTION_SCRIPT,
  DEFAULT_CWV_THRESHOLDS,
  classifyMetric,
  computeOverallVerdict,
  readCwvMetrics,
  type CwvMetrics,
  type CwvThresholds,
  type CwvVerdict,
} from "../../engine/cwv.js";
import type { OpenOptions, Session } from "../../engine/Engine.js";
import {
  measureCwvShape,
  ToolNames,
  type MeasureCwvInput,
} from "../../schema/tools.js";
import { RolepodMcpError } from "../../util/errors.js";
import {
  writeManifest,
  type ManifestArtifact,
  type ManifestStatus,
} from "../../util/manifest.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const measureCwvTool: ToolModule<typeof measureCwvShape> = {
  name: ToolNames.measureCwv,
  description:
    "Measure Core Web Vitals (LCP, INP, CLS) on a live page via PerformanceObserver. Opens a chromium session, navigates, optionally drives a short interaction script, observes for the configured window, and returns metrics + thresholds verdict. Chromium only.",
  inputShape: measureCwvShape,
  build(ctx) {
    return safeHandler(async (args: MeasureCwvInput) => {
      const startedAt = new Date().toISOString();
      const thresholds: CwvThresholds = {
        ...DEFAULT_CWV_THRESHOLDS,
        ...(args.thresholds ?? {}),
      };

      const browser = args.browser ?? "chromium";
      if (browser !== "chromium") {
        throw new RolepodMcpError(
          "cwv_unsupported_browser",
          `measure_cwv requires chromium; got "${browser}". Firefox and WebKit ship partial PerformanceObserver coverage for largest-contentful-paint, layout-shift, and event entry types.`,
          { browser },
        );
      }

      const { runId, runDir, skill } = await ctx.store.startRun("measure_cwv", {
        skill: "measure-cwv",
      });

      // Open WITHOUT a URL so we can add the init script before the first
      // navigation. PerformanceObserver entries replay buffered:true only
      // when the observer is attached before the entries are generated.
      const openOpts: OpenOptions = {
        platform: "web",
        browser: "chromium",
        viewport: args.viewport,
      };
      const session = await ctx.registry.open(openOpts);
      const sessionHandle: Session = { id: session.id, platform: session.platform };
      const engine = ctx.registry.engineFor(session.id);
      if (!(engine instanceof PlaywrightEngine)) {
        throw new RolepodMcpError(
          "unsupported_engine",
          "measure_cwv requires PlaywrightEngine.",
        );
      }

      let metrics: CwvMetrics = { lcp: 0, inp: 0, cls: 0, samples: [] };
      let reportPath: string | undefined;
      try {
        const page = engine.getPageForSession(session.id);
        await page.context().addInitScript({ content: CWV_INJECTION_SCRIPT });

        if (args.emulate?.network_throttle || args.emulate?.cpu_throttle) {
          await engine.setEnv(session.id, {
            networkThrottle: args.emulate.network_throttle,
            cpuThrottle: args.emulate.cpu_throttle,
          });
        }

        await engine.navigate(sessionHandle, args.url);

        const interactions = args.interactions ?? [];
        const hadInteraction = interactions.length > 0;
        for (const step of interactions) {
          await runInteraction(engine, sessionHandle, step);
        }

        await page.waitForTimeout(args.observe_ms);
        metrics = await readCwvMetrics(page);

        const verdict = {
          lcp: classifyMetric("lcp", metrics.lcp, thresholds, true),
          inp: classifyMetric("inp", metrics.inp, thresholds, hadInteraction),
          cls: classifyMetric("cls", metrics.cls, thresholds, true),
        };
        const overall = computeOverallVerdict(verdict);

        const payload = {
          run_id: runId,
          url: args.url,
          metrics: {
            lcp_ms: round(metrics.lcp, 1),
            inp_ms: round(metrics.inp, 1),
            cls: round(metrics.cls, 3),
          },
          verdict,
          thresholds,
          samples: metrics.samples,
        };
        reportPath = await ctx.store.writeReport(
          runDir,
          "cwv.json",
          JSON.stringify(payload, null, 2),
        );

        const status: ManifestStatus = overall;
        const artifacts: ManifestArtifact[] = reportPath
          ? [{ type: "cwv-metrics", path: reportPath }]
          : [];
        const manifestPath = await writeManifest({
          runDir,
          skill,
          phase: "verify",
          status,
          summary: buildSummary(payload),
          startedAt,
          finishedAt: new Date().toISOString(),
          artifacts,
          metadata: {
            url: args.url,
            thresholds,
            verdict,
            metrics: payload.metrics,
            had_interaction: hadInteraction,
          },
        });

        return ok({
          run_id: runId,
          url: args.url,
          metrics: payload.metrics,
          verdict,
          status,
          thresholds,
          report_path: reportPath,
          ...(manifestPath ? { manifest: manifestPath } : {}),
        });
      } finally {
        if (args.close_on_finish) {
          await ctx.registry.close(session).catch(() => undefined);
        }
      }
    });
  },
};

function buildSummary(p: {
  metrics: { lcp_ms: number; inp_ms: number; cls: number };
  verdict: { lcp: CwvVerdict; inp: CwvVerdict; cls: CwvVerdict };
}): string {
  return `LCP=${p.metrics.lcp_ms}ms (${p.verdict.lcp}) · INP=${p.metrics.inp_ms}ms (${p.verdict.inp}) · CLS=${p.metrics.cls} (${p.verdict.cls})`;
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

async function runInteraction(
  engine: PlaywrightEngine,
  session: Session,
  step: NonNullable<MeasureCwvInput["interactions"]>[number],
): Promise<void> {
  switch (step.kind) {
    case "click": {
      const snap = await engine.snapshot(session);
      const ref = resolveQuery(snap, step.query);
      await engine.click(session, ref);
      return;
    }
    case "type": {
      const snap = await engine.snapshot(session);
      const ref = resolveQuery(snap, step.query);
      await engine.type(session, ref, step.text);
      return;
    }
    case "key": {
      await engine.key(session, step.key);
      return;
    }
    case "scroll": {
      await engine.scroll(session, step.direction, step.amount ?? 400);
      return;
    }
  }
}

/**
 * Best-effort name/role/text query → ref resolver. For the simple
 * interaction scripts CWV measurement accepts, walk the snapshot tree
 * and return the first ref whose `name` or `value` contains the query
 * string (case-insensitive). Errors loudly when no match — keeps the
 * tool honest rather than silently skipping a missing target.
 */
function resolveQuery(
  snapshot: { tree: import("../../schema/tools.js").A11yNode },
  query: string,
): string {
  const q = query.toLowerCase();
  const stack: import("../../schema/tools.js").A11yNode[] = [snapshot.tree];
  while (stack.length) {
    const node = stack.pop()!;
    const name = (node.name ?? "").toLowerCase();
    const value = (node.value ?? "").toLowerCase();
    if (name.includes(q) || value.includes(q)) return node.ref;
    if (node.children) stack.push(...node.children);
  }
  throw new RolepodMcpError(
    "unknown_ref",
    `measure_cwv interaction query did not match any node: ${query}`,
    { query },
  );
}
