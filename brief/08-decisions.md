# 08 — Decision Log

Every decision recorded with the options considered, what was chosen, and why. Future maintainers should be able to revisit any decision by reading this file plus the linked brief sections.

---

## D-001 — Build an MCP server (not a markdown patch or a Python library)

**Context.** rolepod's `check-work` and similar skills lack a mechanism to actually verify UI changes. They tell the Lead to "prove with evidence" but provide no tool.

**Options considered.**
1. Markdown-only — patch skills to instruct the Lead to use whatever browser tool is available.
2. Python/TS library — Lead imports and calls.
3. MCP server — Lead calls over MCP.

**Chosen.** MCP server.

**Why.** rolepod is multi-CLI (Claude / Codex / Cursor / Gemini). MCP is the only mechanism all four support uniformly. A library would require per-CLI integration. Markdown-only would shift the entire burden to the user and the Lead's guesswork.

---

## D-002 — Separate repository, not a subdirectory of rolepod

**Context.** rolepod is markdown-only with a bash install. Adding a Node/TS runtime to that repo would mix toolchains and dilute identity.

**Options considered.**
1. Subdirectory of rolepod (monorepo).
2. Workspace inside rolepod (`packages/mcp/`).
3. Separate repo `rolepod-mcp`.

**Chosen.** Separate repo.

**Why.** Independent release cycle. Independent CI. Independent toolchain. The schema sync mechanism (see 06-skill-integration.md) is light enough that separation does not create coordination pain. Identity of the parent repo — "markdown-only lightweight plugin" — is preserved.

**Rejected because.** Monorepo would mean every MCP patch goes through the plugin-marketplace review path of four CLIs. Workspace adds complexity (turborepo/pnpm workspace tooling) for marginal benefit.

---

## D-003 — TypeScript, not Python

**Context.** alumnium (the upstream we're forking from) exists in TS, Python, and Java. We pick one.

**Options considered.**
1. TypeScript.
2. Python.

**Chosen.** TypeScript.

**Why.**
- The official MCP SDK has first-class TS support; the Python SDK is newer and less battle-tested.
- Playwright's canonical API is TS; the Python port lags occasionally.
- Most MCP-capable AI agents are Node-based; TS reduces friction for contributors who already work in that ecosystem.
- Packaging via npm with `npx` zero-install is more uniform than PyPI + uvx + pipx (which fragments the install path).

---

## D-004 — No internal LLM in the MCP server

**Context.** alumnium translates natural-language commands to actions via an internal LLM (OpenAI by default). This means two LLM calls per agent action when used through an outer agent like Claude.

**Options considered.**
1. Internal LLM (alumnium-style).
2. No internal LLM; the Lead agent (Claude/Codex/etc.) makes every decision.

**Chosen.** No internal LLM.

**Why.** Cost (double LLM bill), latency (extra hop), provider lock-in (OpenAI default), and redundancy (the Lead is already an LLM and can pick refs from the snapshot). The rolepod use case is **always** Lead-driven; we never need standalone NL-test-file mode.

---

## D-005 — Fork the alumnium driver + AT layer

**Context.** Building drivers for Playwright + Selenium + Appium from scratch is a multi-month effort. alumnium's driver layer is MIT-licensed and small.

**Options considered.**
1. Build from scratch.
2. Depend on `alumnium` npm package.
3. Fork alumnium's driver + AT layer; drop LLM layer.

**Chosen.** Fork.

**Why.**
- Build from scratch: too expensive, no payoff over alumnium's solid work.
- Depend on alumnium: pulls in LangChain (~30MB transitive) and OpenAI SDK we don't use; alumnium's internal driver classes are not stable public API.
- Fork: small surface, MIT permits, we control what we ship. Quarterly cherry-pick from upstream for bug fixes.

See 04-engine-layer.md for the fork plan and attribution requirements.

---

## D-006 — Two tool tiers: atomic and composite

**Context.** Existing MCP servers (Playwright MCP) expose only atomic actions. Composite operations require the Lead to orchestrate 10–20 atomic calls per verification flow.

**Options considered.**
1. Atomic only.
2. Composite only.
3. Both, with composite as the primary path.

**Chosen.** Both, with composite primary.

**Why.** Composite tools (`verify_ui_flow`, `audit_a11y`, etc.) collapse multi-step workflows into single MCP calls, cutting Lead context cost 5–20×. Atomic tools remain as an escape hatch for situations composites don't cover. Without atomic tools, the MCP would be too rigid; without composite tools, it would be too cheap a clone of Playwright MCP.

---

## D-007 — Multi-platform in one MCP, not three

**Context.** Web + iOS + Android could be three separate MCP servers, each best-of-breed for its platform.

**Options considered.**
1. One MCP server for web, one for iOS, one for Android.
2. One MCP server covering all three.

**Chosen.** One MCP.

**Why.** The Lead agent should see one consistent tool surface. `browser_click(ref)` should mean the same thing whether the platform is web or mobile. Splitting into three MCPs would require the Lead to learn three vocabularies and route per platform. Driver abstraction inside one MCP is the right place for that complexity.

The cost — bundling two driver families (Playwright + Appium/wd) — is accepted.

---

## D-008 — Atomic tool count: 8

**Context.** The atomic surface needs to be complete enough to fall back to for any composite gap, small enough to keep the Lead's choice space sane.

**Options considered.** 5, 8, 12, 15+.

**Chosen.** 8 — `browser_open`, `browser_close`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_key`, `browser_scroll`, `browser_wait_for`, `browser_screenshot`. (Plus an implicit `browser_navigate` rolled into `browser_open` or available within snapshot — final shape TBD in PoC.)

**Why.** 5 would force composites to do too much. 12+ overlaps with composites and confuses the Lead about which to call. 8 covers the 95th-percentile interaction without enumerating every WebDriver verb.

Deliberately deferred (see 03-tool-surface.md): drag-and-drop, file upload, JS execution, PDF, tab switching.

---

## D-009 — Composite tool count: 5

**Context.** Composites map to rolepod phases. Too many and the boundary between them blurs.

**Chosen.** `verify_ui_flow` (assert + reproduce modes), `audit_a11y`, `visual_diff`, `scaffold_e2e`, `extract_ui_state`.

**Why.** Each maps cleanly to a rolepod skill or agent. `verify_ui_flow` → check-work (mode=assert) and debug-issue (mode=reproduce). `audit_a11y` → review-code. `visual_diff` → review-code. `scaffold_e2e` → qa-tester. `extract_ui_state` → multiple. Adding more (e.g. "click_through_form_wizard") would either dilute existing composites or duplicate them.

**Revision history.** Initial choice was 6 composites including a standalone `reproduce_bug`. Revised in D-025 to merge `reproduce_bug` into `verify_ui_flow` as `mode: 'reproduce'` — same shape (drive + assert), different semantic.

---

## D-010 — Refs invalidate on state change

**Context.** When `click(ref="e7")` causes the page to re-render, refs from the prior snapshot are no longer valid. We need a contract.

**Options considered.**
1. Auto-refresh refs after every action (transparent).
2. Refs are valid for one snapshot; structured error on stale.
3. Refs are persistent strings; the engine re-resolves.

**Chosen.** Refs invalid after any state change; structured error on stale use.

**Why.** Option 1 hides correctness bugs; Lead may operate on stale refs and not know. Option 3 is fragile (locators drift). Option 2 forces the Lead to re-snapshot when needed, which is also the correct behavior in test code. The structured error is documented in `04-engine-layer.md → Snapshot freshness rules`.

---

## D-011 — Artifact path convention: `./.rolepod-mcp/artifacts/{run_id}/` *(revised by D-026)*

**Context.** Where do screenshots, HAR files, console logs, replay bundles go?

**Options considered.**
1. Return data inline (base64 in MCP response).
2. Save to a tmp dir each run.
3. Save under a project-relative, run-keyed directory.

**Chosen.** Option 3 — `./.rolepod-mcp/artifacts/{run_id}/`.

**Why.** Inline data blows up Lead context. Tmp dirs don't survive sessions. A project-relative dir aligns with rolepod's existing patterns, lets the Lead reference paths in commit messages, and can be attached to PRs by other tooling. The `{run_id}` slot avoids collisions across simultaneous runs.

This convention is owned by rolepod-mcp but adoptable by anyone — independent MCP users get the convention as a benefit, not a constraint.

---

## D-012 — Engine choice via env, not per-tool

**Context.** Should every tool call accept an engine override, or is engine a server-level setting?

**Chosen.** Server-level via `ROLEPOD_MCP_WEB_ENGINE` env.

**Why.** Per-call would invite confusion ("which engine ran this?") and complicate caching. The Lead does not need to think about engines; it only sees a unified tool surface.

---

## D-013 — No telemetry, ever

**Context.** Many testing/automation tools auto-send anonymous usage stats.

**Chosen.** No telemetry. Documented as a governance commitment.

**Why.** Trust signal. Differentiator. Aligns with rolepod's no-config ethos. The cost (no usage data for product decisions) is acceptable for an open-source project that can survive on community feedback and issues.

---

## D-014 — License: MIT

**Context.** The fork from alumnium constrains us to a permissive license. We also want broad adoption.

**Options considered.** MIT, Apache-2.0, BSD-3-Clause.

**Chosen.** MIT.

**Why.** Matches alumnium upstream (simpler attribution). Shortest, most readable. Maximum adoption. Apache-2.0's patent grant is more protective but creates friction for forks and downstream linking. BSD-3 is essentially equivalent; MIT wins on familiarity.

---

## D-015 — npm package name: `@rolepod/mcp` (with `rolepod-mcp` fallback)

**Context.** Scoped vs unscoped npm package.

**Chosen.** Try `@rolepod/mcp` first. Fall back to `rolepod-mcp` if the scope is unavailable.

**Why.** Scoped name signals the org and leaves room for sibling packages (`@rolepod/skills`, `@rolepod/cli` if those happen). Unscoped is fine as a fallback.

---

## D-016 — Brief stored in `rolepod-mcp/brief/`, not `docs/`

**Context.** Pre-implementation design docs need a home.

**Chosen.** `brief/` at repo root.

**Why.** `docs/` is reserved for public-facing documentation (post-v0.5). `brief/` signals "design artifact, internal." This mirrors rolepod's existing `brief/` directory convention.

---

## D-017 — One soft-gate condition table per integrated skill (no enforcement)

**Context.** How aggressively does rolepod-mcp insert itself into skill workflows?

**Options considered.**
1. Hard-require — `check-work` won't claim done without MCP verification on UI diffs.
2. Soft-suggest — Lead decides per task.
3. Off by default — only when user explicitly invokes.

**Chosen.** Soft-suggest with documented trigger conditions.

**Why.** Hard-require is fragile (MCP not installed = workflow breaks). Off-by-default loses the integration value. Soft-suggest with explicit triggers matches the Lead's role as the judgment center while keeping the workflow productive.

---

## D-018 — Replay bundles are JSON, not binary

**Context.** A replay bundle captures a step sequence so the same flow can re-run without the Lead.

**Chosen.** JSON.

**Why.** Human-readable. Diff-able in PRs. Easy to author by hand for tests. Binary would be slightly smaller but the size advantage is irrelevant; typical bundles are <10KB.

---

## D-019 — `scaffold_e2e` returns a generated file, not a test result

**Context.** Should the MCP run the scaffolded test, or just produce it?

**Chosen.** Produce only. The Lead (or the user) runs it in their test runner.

**Why.** Running tests is the test runner's job. The MCP server is not a CI system. Coupling test generation with test execution makes the MCP a bigger surface than it needs to be.

---

## D-020 — Mobile is optional at install time, not a separate package

**Context.** Should mobile drivers ship in the same package as web?

**Options considered.**
1. Single package, mobile drivers as `optionalDependencies`.
2. Two packages: `@rolepod/mcp` (web) and `@rolepod/mcp-mobile`.

**Chosen.** Single package with `optionalDependencies`.

**Why.** One install command. Mobile users opt in via `npx rolepod-mcp install:mobile`. Two packages would force users to know in advance and would split documentation. Optional deps are the npm-native way to express this.

---

## D-021 — Defer monorepo conversion until there's a second package

**Context.** Will we eventually need `@rolepod/skills`, `@rolepod/cli`, etc. as siblings?

**Chosen.** Stay single-package until a concrete second package is needed.

**Why.** Premature monorepo tooling (turborepo, pnpm workspace) creates complexity now for a maybe-later benefit. When a second package appears, convert at that moment.

---

## D-026 — Artifact path namespace: `./.rolepod-mcp/`, not `./.rolepod/`

**Context.** Initially the artifact convention was `./.rolepod/artifacts/{run_id}/` (D-011). A collision audit against the rolepod parent revealed it uses `~/.rolepod/` (home dir) for plugin install location and backups (commit `df45b0b`). While the technical paths differ (home vs CWD), the conceptual collision is real — users seeing `.rolepod/` in two places would conflate them, and future expansion by either side risks real collision.

**Options considered.**
1. Keep `./.rolepod/artifacts/{run_id}/` and accept the conceptual overlap.
2. Move to `./.rolepod/mcp/artifacts/{run_id}/` — sub-namespace inside parent's path.
3. Move to `./.rolepod-mcp/artifacts/{run_id}/` — distinct top-level namespace.

**Chosen.** Option 3 — `./.rolepod-mcp/artifacts/{run_id}/`.

**Why.** Each plugin owns its own top-level dot-directory in the working tree. rolepod-mcp's namespace is `.rolepod-mcp/`. Parent rolepod's namespace is `~/.rolepod/` (and any future CWD usage would be `.rolepod/`). No overlap. Easier to `.gitignore`. Easier to clean. Easier to grep.

**Impact on brief.** Updated `02-architecture.md`, `05-open-source.md`, `07-install-ux.md`, `08-decisions.md` (D-011 revised), `11-plugin-skills.md`.

---

## D-025 — Merge `/reproduce-bug` into `/verify-ui` as `mode: 'reproduce'`

**Context.** Initial design (D-009 v1) had `/reproduce-bug` as a separate shipped skill wrapping a `rolepod_reproduce_bug` composite tool. A skill audit revealed it has the same shape as `/verify-ui` (drive a UI through steps + check assertions), differing only in:
- assertion semantic: "expect bug to surface" vs "expect feature to work"
- one extra post-processing step: step minimization when reproduced

**Options considered.**
1. Keep `/reproduce-bug` as a separate skill (status quo).
2. Merge into `/verify-ui` with `mode: 'assert' | 'reproduce'` parameter and optional `minimize` flag.
3. Single uber-skill that does verify + reproduce + audit + visual-diff via mode.

**Chosen.** Option 2.

**Why.** 
- Shape is genuinely the same; treating it as a separate skill duplicates schemas and confuses the Lead about which to pick.
- Mode parameter is honest about the relationship: assertions describe expected state, regardless of whether the user wants that state to be "feature works" or "bug surfaces".
- Step minimization is an easy add-on triggered by `mode='reproduce' && passed=true`.
- Reduces skill count 5 → 4 and composite tool count 6 → 5.
- Parent's `debug-issue` skill simply calls `/verify-ui` with `mode='reproduce'` — clearer mental model than dispatching to a different skill.

**Rejected.**
- Option 1: duplication; cognitive load on the Lead choosing between two near-identical skills.
- Option 3: too aggressive; a11y audit and visual diff have genuinely different output schemas and stateful concerns (D-009 reasoning still applies).

**Impact on brief.** Updated `02-architecture.md`, `03-tool-surface.md`, `04-engine-layer.md`, `06-skill-integration.md`, `09-roadmap.md`, `11-plugin-skills.md`, `00-INDEX.md`.

---

## D-024 — Fallback chain lives in parent rolepod skills, not in shipped skills

**Context.** After settling on the plugin model (D-023), the next question was where multi-backend fallback (rolepod-mcp → Playwright MCP → Chrome DevTools MCP → manual) belongs.

**Options considered.**
1. **Fallback inside shipped skills.** Every shipped skill (`/verify-ui` etc.) checks for rolepod-mcp first, then other MCPs, then manual.
2. **Fallback in parent rolepod skills only.** Shipped skills are single-backend (call rolepod-mcp only); parent rolepod's `check-work`, `debug-issue`, `using-rolepod` skills implement the multi-backend chain.

**Chosen.** Fallback in parent rolepod skills only.

**Why.**
- **Single responsibility.** Shipped skills are pure adapters for rolepod-mcp. They have one job: call the right MCP tool. They do not need to know about Playwright MCP, Chrome DevTools MCP, or anything else.
- **Parent value is explicit.** Multi-backend routing is what the rolepod workflow promises. That logic belongs in the parent, where it is the visible value-add.
- **Standalone user clarity.** A user who installs only rolepod-mcp (no parent) gets straightforward skills. Invoke `/verify-ui`; it calls the MCP; if the MCP is down, it says so plainly. No hidden alternate paths.
- **Failure modes are honest.** If the rolepod-mcp server is unreachable, a shipped skill fails with a clear diagnostic ("MCP server unavailable") instead of silently degrading to a different backend that may produce different-looking results.
- **Maintenance and testing.** Shipped skills are easier to test (one backend); parent skills are the place to test routing logic.
- **No assumption about other MCPs.** Shipped skills do not need to know `browser_*` exists. The list of "other MCPs we know about" lives in one place — parent skill markdown — and can evolve there without touching shipped skills.

**Rejected because.** Option 1 (fallback in shipped skills) would force every shipped skill to contain orchestration logic for atomic Playwright MCP calls, manual-instruction prose, and detection of MCP availability. This is a lot of complexity per skill, and it duplicates across skills, and it conflates the adapter role with the orchestrator role. Worse, a user who installs rolepod-mcp standalone would not even know the fallback was happening — they would expect a rolepod-mcp call and might silently get a Playwright atomic-orchestration path with subtly different artifact conventions.

**Impact on the brief.** Documents 06 and 11 were rewritten to reflect this. Shipped skill templates no longer include a "Backend resolution" section. Parent rolepod patch examples in 06 contain the full multi-backend chain.

---

## D-023 — Ship as a plugin (skills + MCP), not bare MCP

**Context.** After v0.1 PoC scoping, an alternative architecture was raised: bundle the markdown skills *inside* the rolepod-mcp distribution itself, so the install delivers both the MCP server runtime AND user-invocable skills. Compare with the original plan of shipping only an MCP server and patching the parent rolepod repo's skills.

**Options considered.**
1. **Bare MCP server.** Parent rolepod repo patches 11 skills + 16 agents to call rolepod-mcp tools. Schema snapshot file in parent. CI sync gate.
2. **Plugin (MCP + skills bundled).** rolepod-mcp ships its own skills (`/verify-ui`, `/audit-a11y`, etc.) that wrap MCP tool calls. Parent rolepod gets at most 3 lightweight "if available, suggest" hints.

**Chosen.** Plugin model.

**Why.**
- **Standalone use becomes natural.** Users who don't use rolepod parent at all get a complete experience — install plugin, use slash commands, done.
- **Naming collisions vanish.** Skills wrap tool names. The Lead invokes `/verify-ui`, not `rolepod_verify_ui_flow`. Coexistence with Playwright MCP / Chrome DevTools MCP becomes trivial.
- **Schema sync ceases to be a problem.** Skills live in the same repo as the MCP server they call. They drift in lockstep.
- **Parent rolepod stays light.** No mass patching of agents. Three short pointer insertions instead of 27 file edits.
- **Multi-MCP fallback fits naturally.** Each shipped skill has a fallback chain — prefer rolepod-mcp, fall back to other MCPs, then to manual. The user gets graceful degradation.
- **Adoption simplifies.** One install command. One mental model.

**Rejected because.** The bare-MCP model would have forced every consumer (including non-rolepod users) to write their own skill markdown to get any ergonomic benefit. It also tied the parent rolepod repo's release cadence to rolepod-mcp's schema cadence — operational drag for no win.

**Impact on the brief.** Documents 02, 03, 06, 07 were updated. Document 11 was added. The plugin layer is now the primary distribution model; bare MCP install remains as a fallback for tooling without plugin support.

---

## D-022 — Brief is markdown, 10 files, not one giant doc

**Context.** Design docs can be one long file or split.

**Chosen.** 10 files, ~200–400 lines each, numbered, with an INDEX.

**Why.** Easier to update incrementally. Future sessions can load only the sections they need (e.g. just `03-tool-surface.md` when working on a tool change). One giant doc would force a re-read for any change.

---

## D-027 — `browser_navigate` is its own atomic tool (atomic count: 10, not 8)

**Context.** Brief D-008 fixed the atomic count at 8 but left `browser_navigate` "rolled into `browser_open` or available within snapshot — final shape TBD in PoC." During v0.2 implementation we hit the question concretely.

**Options considered.**
1. **No `browser_navigate` tool** — every URL change requires `browser_close` + `browser_open`.
2. **`browser_open` accepts re-navigation** — calling `open` on an existing `session_id` re-uses the session and just navigates.
3. **`browser_navigate(session_id, url)` as a distinct atomic.**

**Chosen.** Option 3. The atomic count becomes 10 (was 8 in brief D-008, then 9 with snapshot counted).

**Why.**
- Tearing down a browser per URL hop is wasteful (login state, cookies, perf timing all reset). Option 1 forces this.
- Overloading `browser_open` (Option 2) breaks the symmetry of `open ↔ close` and confuses the Lead: "did open return a fresh session or reuse mine?" The `Session` type has no field distinguishing reused vs. new.
- A dedicated `browser_navigate` is the same verb the engine interface already exposes (`Engine.navigate(session, url)`); the atomic tool is a 1:1 wrapper, which is the rule for atomics in general.
- The "TBD in PoC" clause in D-008 explicitly invites this decision.

**Rejected because.** Option 1 produces ugly multi-call flows for every `/verify-ui` that touches more than one URL. Option 2 introduces stateful behavior on a tool whose name suggests "fresh open".

**Trade-off.** Atomic count slips from 8 to 10. We accept it because the Lead's mental model stays cleaner (one verb per primitive). The brief's "8 atomic" header in `03-tool-surface.md` is now treated as a v0.1 design heuristic, not a hard upper bound.

**Out of scope still:** `drag_and_drop`, `upload_file`, `execute_javascript`, `print_to_pdf`, `switch_tab` — still deferred per brief's "What this does *not* expose" list.

**Impact on brief.** `03-tool-surface.md` header should be updated to "Atomic tools (10)" when next revised. `09-roadmap.md → v0.1` exit criteria are unaffected (it lists atomic primitives by *role*, not by count).
