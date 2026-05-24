import {
  ToolNames,
  verifyUiFlowShape,
  type A11yNode,
  type VerifyUiFlowInput,
} from "../../schema/tools.js";
import type { A11ySnapshot, Engine, Session } from "../../engine/Engine.js";
import { RolepodMcpError } from "../../util/errors.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

/**
 * Composite `verify_ui_flow` — drive a session through steps and evaluate
 * expectations against the resulting state. v0.1 implements `mode='assert'`
 * only; `mode='reproduce'` (with step minimization) lands in v0.2 (D-025).
 */
export const verifyUiFlowTool: ToolModule<typeof verifyUiFlowShape> = {
  name: ToolNames.verifyUiFlow,
  description:
    "Open a session, run an ordered list of UI steps, evaluate assertions, save evidence, and return pass/fail with the run_id. v0.1: mode='assert' only.",
  inputShape: verifyUiFlowShape,
  build(ctx) {
    return safeHandler(async (args: VerifyUiFlowInput) => {
      if (args.mode === "reproduce") {
        throw new RolepodMcpError(
          "not_implemented_in_v01",
          "mode='reproduce' is scheduled for v0.2. Use mode='assert' for v0.1.",
          { requested_mode: args.mode },
        );
      }

      const { runId, runDir } = await ctx.store.startRun("verify");
      const evidence: {
        screenshots: string[];
        replay_bundle?: string;
      } = { screenshots: [] };

      const session = await ctx.registry.open(args.open);
      const engine = ctx.registry.engineFor(session.id);
      const sessionHandle: Session = { id: session.id, platform: session.platform };

      let passed = false;
      let failedAtStep: number | undefined;
      let failureReason: string | undefined;
      let finalSnapshot: A11ySnapshot | undefined;

      try {
        // ---------------- steps ----------------
        for (let i = 0; i < args.steps.length; i++) {
          const step = args.steps[i]!;
          const beforeSnap = await engine.snapshot(sessionHandle);
          try {
            await runStep(engine, sessionHandle, step, beforeSnap);
          } catch (err) {
            failedAtStep = i;
            failureReason = `Step ${i} (${step.kind}) failed: ${describeError(err)}`;
            throw err;
          }
        }

        // -------------- assertions --------------
        finalSnapshot = await engine.snapshot(sessionHandle);
        const failures: string[] = [];
        for (let i = 0; i < args.expect.length; i++) {
          const expectation = args.expect[i]!;
          const ok = evaluateExpect(expectation, finalSnapshot);
          if (!ok) failures.push(`expect[${i}] ${describeExpect(expectation)}`);
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
        // ----------- evidence capture -----------
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
          evidence.replay_bundle = await ctx.store.writeReplayBundle(runDir, {
            version: 1,
            run_id: runId,
            recorded_at: new Date().toISOString(),
            open: args.open as unknown as Record<string, unknown>,
            steps: args.steps as unknown as Record<string, unknown>[],
            expect: args.expect as unknown as Record<string, unknown>[],
          });
        } catch {
          /* swallow — replay bundle is best-effort */
        }
        if (args.close_on_finish) {
          await ctx.registry.close(sessionHandle).catch(() => undefined);
        }
      }

      const result: Record<string, unknown> = {
        run_id: runId,
        passed,
        evidence_paths: evidence,
      };
      if (failedAtStep !== undefined) result.failed_at_step = failedAtStep;
      if (failureReason !== undefined) result.failure_reason = failureReason;
      if (finalSnapshot) {
        result.final_url_or_screen = finalSnapshot.url_or_screen;
      }
      return ok(result);
    });
  },
};

// ---------------------------------------------------------------------------
// Step + expect evaluation helpers
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
          return true; // present in snapshot ⇒ visible (interestingOnly default)
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
