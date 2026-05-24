import {
  extractUiStateShape,
  ToolNames,
  type A11yNode,
  type ExtractUiStateInput,
} from "../../schema/tools.js";
import type { Session } from "../../engine/Engine.js";
import { RolepodMcpError } from "../../util/errors.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

/**
 * Returns the most-relevant accessibility-tree subtree plus the refs
 * matched by the question. **No LLM is invoked** — the Lead interprets
 * the returned subtree. See brief/03-tool-surface.md.
 */
export const extractUiStateTool: ToolModule<typeof extractUiStateShape> = {
  name: ToolNames.extractUiState,
  description:
    "Return the AT-tree subtree most likely to answer a natural-language question, plus matched refs. No LLM is called — the Lead does the interpretation.",
  inputShape: extractUiStateShape,
  build(ctx) {
    return safeHandler(async (args: ExtractUiStateInput) => {
      let session: Session;
      let openedHere = false;
      if (args.session_id) {
        const engine = ctx.registry.engineFor(args.session_id);
        session = { id: args.session_id, platform: "web" };
        void engine;
      } else if (args.open) {
        session = await ctx.registry.open(args.open);
        openedHere = true;
      } else {
        throw new RolepodMcpError(
          "invalid_input",
          "Provide either `session_id` (existing session) or `open` (to start one).",
        );
      }

      try {
        const engine = ctx.registry.engineFor(session.id);
        const snap = await engine.snapshot(session);
        const tokens = tokenize(args.question_nl);
        const matches = scoreTree(snap.tree, tokens);
        const top = matches[0];
        const subtree = top
          ? (top.subtree as A11yNode)
          : snap.tree;
        const matchedRefs = matches.slice(0, 8).map((m) => m.ref);

        let confidence: "high" | "medium" | "low" = "low";
        if (top) {
          if (top.score >= tokens.length && tokens.length > 0) confidence = "high";
          else if (top.score >= Math.max(1, Math.ceil(tokens.length / 2)))
            confidence = "medium";
        }

        return ok({
          snapshot_ref: snap.taken_at,
          confidence,
          matched_refs: matchedRefs,
          value: subtree,
          url_or_screen: snap.url_or_screen,
        });
      } finally {
        if (openedHere && args.close_on_finish) {
          await ctx.registry.close(session).catch(() => undefined);
        }
      }
    });
  },
};

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

type ScoredMatch = {
  ref: string;
  score: number;
  subtree: A11yNode;
};

function scoreTree(root: A11yNode, tokens: string[]): ScoredMatch[] {
  const matches: ScoredMatch[] = [];
  const visit = (node: A11yNode, ancestors: A11yNode[]): void => {
    const hay = `${node.name ?? ""} ${node.value ?? ""}`.toLowerCase();
    let score = 0;
    for (const t of tokens) if (hay.includes(t)) score += 1;
    if (score > 0) {
      // surface the matching node plus one ancestor for context
      const subtree = ancestors.length > 0 ? ancestors[ancestors.length - 1]! : node;
      matches.push({ ref: node.ref, score, subtree });
    }
    if (node.children) {
      for (const c of node.children) visit(c, [...ancestors, node]);
    }
  };
  visit(root, []);
  matches.sort((a, b) => b.score - a.score);
  return matches;
}
