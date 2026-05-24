import {
  ToolNames,
  verifyUiFlowShape,
  type A11yNode,
  type VerifyUiFlowInput,
} from "../../schema/tools.js";
import type { A11ySnapshot, Engine, Session } from "../../engine/Engine.js";
import { RolepodMcpError } from "../../util/errors.js";
import { ok, safeHandler } from "../result.js";
import type { ToolContext, ToolModule } from "../types.js";

/**
 * Composite `verify_ui_flow` — drive a session through steps and evaluate
 * expectations against the resulting state.
 *
 * - `mode: 'assert'` (default): pass = "expected feature works".
 * - `mode: 'reproduce'`: pass = "expected bug surfaced". When `minimize`
 *   is true (default) and the initial run reproduces, the composite
 *   performs a linear delta-removal pass over `steps` to find a smaller
 *   sequence that still reproduces. See D-025.
 */
export const verifyUiFlowTool: ToolModule<typeof verifyUiFlowShape> = {
  name: ToolNames.verifyUiFlow,
  description:
    "Open a session, run UI steps, evaluate assertions, and save evidence. Set mode='reproduce' for bug reproduction with optional step minimization.",
  inputShape: verifyUiFlowShape,
  build(ctx) {
    return safeHandler(async (args: VerifyUiFlowInput) => {
      const { runId, runDir } = await ctx.store.startRun("verify");

      const initial = await runFlow(ctx, args, args.steps, runDir, {
        captureEvidence: true,
        bundleName: "replay.json",
      });

      const result: Record<string, unknown> = {
        run_id: runId,
        mode: args.mode,
        passed: initial.passed,
        evidence_paths: initial.evidence,
      };
      if (initial.failedAtStep !== undefined) result.failed_at_step = initial.failedAtStep;
      if (initial.failureReason !== undefined) result.failure_reason = initial.failureReason;
      if (initial.finalUrl !== undefined) result.final_url_or_screen = initial.finalUrl;

      if (args.mode === "reproduce" && initial.passed && args.minimize) {
        const min = await minimize(ctx, args, args.steps, runDir);
        result.minimized = {
          original_step_count: args.steps.length,
          minimized_step_count: min.steps.length,
          steps_removed: min.removed,
          replay_bundle: min.replayPath,
          attempts: min.attempts,
        };
      }

      return ok(result);
    });
  },
};

// ---------------------------------------------------------------------------
// Core single-run logic — shared by the initial run and every minimization
// attempt.
// ---------------------------------------------------------------------------

type RunOutcome = {
  passed: boolean;
  failedAtStep?: number;
  failureReason?: string;
  finalUrl?: string;
  evidence: { screenshots: string[]; replay_bundle?: string };
};

async function runFlow(
  ctx: ToolContext,
  args: VerifyUiFlowInput,
  steps: VerifyUiFlowInput["steps"],
  runDir: string,
  opts: { captureEvidence: boolean; bundleName: string },
): Promise<RunOutcome> {
  const evidence: { screenshots: string[]; replay_bundle?: string } = { screenshots: [] };
  let passed = false;
  let failedAtStep: number | undefined;
  let failureReason: string | undefined;
  let finalSnapshot: A11ySnapshot | undefined;

  const session = await ctx.registry.open(args.open);
  const engine = ctx.registry.engineFor(session.id);
  const sessionHandle: Session = { id: session.id, platform: session.platform };

  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      const beforeSnap = await engine.snapshot(sessionHandle);
      try {
        await runStep(engine, sessionHandle, step, beforeSnap);
      } catch (err) {
        failedAtStep = i;
        failureReason = `Step ${i} (${step.kind}) failed: ${describeError(err)}`;
        throw err;
      }
    }

    finalSnapshot = await engine.snapshot(sessionHandle);
    const failures: string[] = [];
    for (let i = 0; i < args.expect.length; i++) {
      const expectation = args.expect[i]!;
      if (!evaluateExpect(expectation, finalSnapshot)) {
        failures.push(`expect[${i}] ${describeExpect(expectation)}`);
      }
    }
    if (failures.length === 0) {
      passed = true;
    } else {
      failureReason = `Expectations failed: ${failures.join("; ")}`;
    }
  } catch (err) {
    if (!failureReason) failureReason = describeError(err);
    passed = false;
  } finally {
    if (opts.captureEvidence) {
      const wantScreenshot = !args.capture || args.capture.includes("screenshot");
      if (wantScreenshot) {
        try {
          const buf = await engine.screenshot(sessionHandle, true);
          const p = await ctx.store.writeScreenshot(runDir, buf, "final");
          evidence.screenshots.push(p);
        } catch (err) {
          failureReason ??= `screenshot capture failed: ${describeError(err)}`;
        }
      }
      try {
        evidence.replay_bundle = await ctx.store.writeReplayBundle(
          runDir,
          {
            version: 1,
            run_id: runDir.split("/").pop() ?? "run",
            recorded_at: new Date().toISOString(),
            open: args.open as unknown as Record<string, unknown>,
            steps: steps as unknown as Record<string, unknown>[],
            expect: args.expect as unknown as Record<string, unknown>[],
          },
          opts.bundleName,
        );
      } catch {
        /* swallow — replay bundle is best-effort */
      }
    }
    if (args.close_on_finish) {
      await ctx.registry.close(sessionHandle).catch(() => undefined);
    }
  }

  const out: RunOutcome = { passed, evidence };
  if (failedAtStep !== undefined) out.failedAtStep = failedAtStep;
  if (failureReason !== undefined) out.failureReason = failureReason;
  if (finalSnapshot) out.finalUrl = finalSnapshot.url_or_screen;
  return out;
}

// ---------------------------------------------------------------------------
// Linear delta-removal — naive but bounded by the step count.
// ---------------------------------------------------------------------------

type MinimizeResult = {
  steps: VerifyUiFlowInput["steps"];
  removed: number[];
  attempts: number;
  replayPath: string | undefined;
};

async function minimize(
  ctx: ToolContext,
  args: VerifyUiFlowInput,
  initialSteps: VerifyUiFlowInput["steps"],
  runDir: string,
): Promise<MinimizeResult> {
  let current = [...initialSteps];
  const removedFromOriginal: number[] = [];
  const originalIndex: number[] = initialSteps.map((_, i) => i);
  let attempts = 0;

  let i = 0;
  while (i < current.length) {
    attempts += 1;
    const candidate = [...current.slice(0, i), ...current.slice(i + 1)];
    const outcome = await runFlow(ctx, args, candidate, runDir, {
      captureEvidence: false,
      bundleName: "minimize-tmp.json",
    });
    if (outcome.passed) {
      removedFromOriginal.push(originalIndex[i]!);
      current = candidate;
      originalIndex.splice(i, 1);
      // do NOT advance i — re-test the new step that took position i
    } else {
      i += 1;
    }
  }

  // One final capture run with the minimized sequence to anchor evidence.
  let replayPath: string | undefined;
  if (current.length !== initialSteps.length) {
    const finalRun = await runFlow(ctx, args, current, runDir, {
      captureEvidence: true,
      bundleName: "replay-minimized.json",
    });
    replayPath = finalRun.evidence.replay_bundle;
  }
  return { steps: current, removed: removedFromOriginal.sort((a, b) => a - b), attempts, replayPath };
}

// ---------------------------------------------------------------------------
// Step + expect evaluation helpers (shared with mode='assert').
// ---------------------------------------------------------------------------

async function runStep(
  engine: Engine,
  session: Session,
  step: VerifyUiFlowInput["steps"][number],
  snap: A11ySnapshot,
): Promise<void> {
  switch (step.kind) {
    case "click": {
      const ref = findRefByQuery(snap.tree, step.query);
      if (!ref) throw missingQuery(step.query);
      await engine.click(session, ref);
      return;
    }
    case "type": {
      const ref = findRefByQuery(snap.tree, step.query);
      if (!ref) throw missingQuery(step.query);
      await engine.type(
        session,
        ref,
        step.text,
        step.clear_first ? { clearFirst: true } : undefined,
      );
      return;
    }
    case "key":
      await engine.key(session, step.key);
      return;
    case "wait_for":
      await engine.waitFor(session, step.condition);
      return;
    case "navigate":
      await engine.navigate(session, step.url);
      return;
  }
}

function evaluateExpect(
  exp: VerifyUiFlowInput["expect"][number],
  snap: A11ySnapshot,
): boolean {
  switch (exp.kind) {
    case "text_visible":
      return treeHasText(snap.tree, exp.text);
    case "text_absent":
      return !treeHasText(snap.tree, exp.text);
    case "url_matches":
      return new RegExp(exp.pattern).test(snap.url_or_screen);
    case "ref_in_state": {
      const node = findNodeByQuery(snap.tree, exp.query);
      if (!node) return false;
      switch (exp.state) {
        case "visible":
          return true;
        case "enabled":
          return node.state?.disabled !== true;
        case "focused":
          return node.state?.focused === true;
      }
    }
  }
}

function describeExpect(exp: VerifyUiFlowInput["expect"][number]): string {
  switch (exp.kind) {
    case "text_visible":
      return `text_visible "${exp.text}"`;
    case "text_absent":
      return `text_absent "${exp.text}"`;
    case "url_matches":
      return `url_matches /${exp.pattern}/`;
    case "ref_in_state":
      return `ref_in_state "${exp.query}" → ${exp.state}`;
  }
}

function missingQuery(query: string): RolepodMcpError {
  return new RolepodMcpError(
    "invalid_input",
    `No element matched query "${query}" in the current snapshot.`,
    { query },
  );
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function findRefByQuery(tree: A11yNode, query: string): string | null {
  const node = findNodeByQuery(tree, query);
  return node ? node.ref : null;
}

function findNodeByQuery(tree: A11yNode, query: string): A11yNode | null {
  const target = query.toLowerCase();
  const visit = (node: A11yNode): A11yNode | null => {
    if (
      (node.name && node.name.toLowerCase().includes(target)) ||
      (node.value && node.value.toLowerCase().includes(target))
    ) {
      return node;
    }
    if (node.children) {
      for (const c of node.children) {
        const hit = visit(c);
        if (hit) return hit;
      }
    }
    return null;
  };
  return visit(tree);
}

function treeHasText(tree: A11yNode, text: string): boolean {
  const target = text.toLowerCase();
  const visit = (node: A11yNode): boolean => {
    if (
      (node.name && node.name.toLowerCase().includes(target)) ||
      (node.value && node.value.toLowerCase().includes(target))
    ) {
      return true;
    }
    return node.children?.some(visit) ?? false;
  };
  return visit(tree);
}
