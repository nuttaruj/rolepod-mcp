# 10 — Risk Register

Each risk has: probability (P), impact (I), and a mitigation. Probability and impact use **L/M/H** scale.

---

## Technical risks

### T-1 — alumnium upstream changes their driver layer incompatibly

- **P:** M  **I:** L
- **Why.** alumnium is actively developed; their driver/AT layer is not public API.
- **Mitigation.** We fork (D-005), so upstream changes don't break us. We track upstream quarterly and cherry-pick selectively. We do not depend on upstream stability.

### T-2 — Playwright API breakage in a major version

- **P:** L  **I:** M
- **Why.** Playwright has stable majors but occasionally moves semantics.
- **Mitigation.** Pin major version in `package.json`. Test against `latest` in CI to catch upcoming changes early. Maintain a version-compat note in CHANGELOG.

### T-3 — Appium driver instability (XCUITest or UIAutomator2)

- **P:** H  **I:** M
- **Why.** Mobile automation is famously flaky. XCUITest and UIAutomator2 ship issues regularly.
- **Mitigation.** Mobile is opt-in (`install:mobile`). Failure modes documented in `doctor`. Smoke test suite runs mobile drivers in CI on the platforms that support it (macOS for iOS, Linux for Android via emulator). Accept that mobile reliability lags web.

### T-4 — Stale-ref bugs in Lead usage

- **P:** H  **I:** L
- **Why.** Most common Lead-side bug pattern: using a ref after an action invalidates it.
- **Mitigation.** Structured `stale_ref` error (D-010) with last-valid-snapshot timestamp. Skill markdown for `check-work` documents the snapshot-then-act loop. Composite tools snapshot internally, so most users avoid this.

### T-5 — Snapshot size blows up Lead context

- **P:** M  **I:** M
- **Why.** A complex web page can produce a 50KB+ AT tree.
- **Mitigation.**
  - `mode: 'visible'` default — only viewport-visible nodes.
  - Composite tools never return full snapshots; they return summaries + artifact paths.
  - `extract_ui_state` returns a subtree, not the whole tree.
  - Document the cost in the README and skill markdown.

### T-6 — Concurrency bugs in `SessionRegistry`

- **P:** M  **I:** M
- **Mitigation.** Per-session operations are serialized internally. Test with `vitest` concurrent test runs against multiple sessions. Document the concurrency contract in `02-architecture.md`.

### T-7 — Artifact dir grows unboundedly

- **P:** H  **I:** L
- **Mitigation.** `--max-runs-retained` CLI flag (default 50). `rolepod-mcp gc` subcommand to manually clean. Document the path in README so users can `.gitignore` it.

### T-8 — MCP protocol version drift

- **P:** L  **I:** M
- **Why.** MCP spec is young; transports and message shapes evolve.
- **Mitigation.** Pin a major version of `@modelcontextprotocol/sdk`. Test against the CLIs we care about (Claude Code, Codex, Cursor, Gemini) in CI. Subscribe to MCP spec updates.

---

## License & legal risks

### L-1 — Insufficient attribution to alumnium

- **P:** L  **I:** H
- **Why.** Fork without proper MIT attribution can damage relationships and possibly expose us.
- **Mitigation.** Per-file headers on every forked file. `THIRD_PARTY.md` at repo root. README acknowledgement. CHANGELOG v0.1 entry. Reach out to alumnium maintainers before v0.5 (open source launch) as a courtesy.

### L-2 — A bundled dependency turns out to be non-permissive

- **P:** L  **I:** M
- **Mitigation.** CI step runs `license-checker` against the dependency tree. Allowlist: MIT, Apache-2.0, BSD-2/3, ISC. PR fails on anything else.

### L-3 — Patent claims on a screenshot or AT-tree technique

- **P:** L  **I:** L
- **Mitigation.** Use established techniques (Chromium's a11y API, Playwright's `accessibility.snapshot`, Appium's standard tree APIs). Do not invent novel algorithms. If a question arises, switch to a different approach.

---

## Adoption risks

### A-1 — Playwright MCP already covers most users

- **P:** H  **I:** H
- **Why.** Microsoft's official server has gravity. Most users hit "good enough" with it.
- **Mitigation.** Differentiate honestly (05-open-source.md). Composite tools and mobile support are the two pillars. If Microsoft adds composite/phase tools or mobile, our value shrinks — accept that and pivot.

### A-2 — Mobile setup is too painful

- **P:** M  **I:** M
- **Why.** Xcode + Android SDK installation is rough territory; users may abandon.
- **Mitigation.** `doctor` subcommand with copy-pasteable fixes. Pre-flight checks before install. Don't require mobile to use web (split install).

### A-3 — Composite tools are the wrong abstraction

- **P:** M  **I:** H
- **Why.** Phase-aware tools might be too rolepod-specific for general MCP users.
- **Mitigation.** Each composite is independently useful (a `verify_ui_flow` works for anyone, not just rolepod users). Atomic tools provide the escape hatch. Solicit feedback from non-rolepod users in v0.2 and adjust.

### A-4 — npm name `@rolepod/mcp` is taken

- **P:** L  **I:** L
- **Mitigation.** Fallback to `rolepod-mcp` (unscoped). Cosmetic only.

### A-5 — Repository ownership transition (user → org)

- **P:** M  **I:** L
- **Why.** Repo starts at `nuttaruj/rolepod-mcp`; may move to a `rolepod` org.
- **Mitigation.** GitHub redirects survive transfers. Document the move in CHANGELOG when it happens. Update npm package's `repository` field.

---

## Maintenance risks

### M-1 — Solo maintainer burnout

- **P:** M  **I:** H
- **Mitigation.** Conservative scope (anti-roadmap in 09). Issue triage cadence published. Welcome second maintainer aggressively. Accept that maintenance pace may slow; document this honestly.

### M-2 — Forked code drifts so far it's hard to cherry-pick fixes

- **P:** M  **I:** L
- **Mitigation.** Keep forked files near their original structure for as long as practical. Move structure changes to wrapper files that import the forked code rather than rewriting it. `UPSTREAM_TRACKING.md` records the SHA we forked from.

### M-3 — Schema breakage between v0.x releases

- **P:** M  **I:** M
- **Why.** Pre-v1.0 we explicitly allow schema changes. Skill markdown in the parent rolepod repo can fall out of sync.
- **Mitigation.** Schema snapshot file in parent repo + CI sync gate (06-skill-integration.md). CHANGELOG entries flag schema changes explicitly. v0 → v1 migration guide.

### M-4 — Tests against real browsers/devices are slow and flaky

- **P:** H  **I:** L
- **Mitigation.** Tiered test suite: unit (fast, no browser), smoke (one browser, fast), full (all engines, slow, CI-only nightly). Retry policy in CI for known-flaky mobile tests (cap at 2 retries with explicit logging).

### M-5 — Documentation rots faster than code

- **P:** M  **I:** M
- **Mitigation.** Schema export is the source of truth; docs generated from it where possible. Recipes in `docs/recipes/` are tested with a runnable check (a Bash script that exercises each recipe). README has a "last verified for v0.X" badge.

---

## Operational risks

### O-1 — CI cost spikes (browsers + mobile emulators)

- **P:** M  **I:** L
- **Mitigation.** Full matrix runs only on `main` and release tags. PR CI runs minimal smoke. Move expensive jobs to nightly. Use GitHub free tier; do not introduce paid CI before there's revenue.

### O-2 — A vulnerability in a transitive dep

- **P:** M  **I:** M
- **Mitigation.** Dependabot enabled. Security disclosures via `SECURITY.md` with a 90-day private window. Minimal direct deps to reduce surface.

### O-3 — Someone publishes a malicious `rolepod-mcp` lookalike

- **P:** L  **I:** M
- **Mitigation.** Claim both `@rolepod/mcp` and `rolepod-mcp` on npm immediately. Document the canonical install path in README. Provide checksums on releases.

---

## Risk ownership

All risks above are owned by the maintainer until a second maintainer joins. The risk register is reviewed at each milestone exit. Risks downgraded to ignorable are crossed out (not deleted) so the history is visible.

## Risk acceptance threshold

A risk is **accepted** (no mitigation beyond awareness) if:

- P × I score is at the L×L corner of the matrix, OR
- Mitigation cost exceeds the expected loss, OR
- The risk is intrinsic to a deliberate design choice (e.g. A-1 — Playwright MCP exists; we accept the competition).

All other risks must have a documented mitigation, even if the mitigation is "monitor and revisit."
