## Summary

<!-- 1–3 bullets. What changes and why. -->

## Brief alignment

<!-- If the diff deviates from `brief/`, name the decision (D-xxx) you're invoking or adding. -->

- Layer touched: <!-- engine / tool / composite / skill / cli / build / docs -->
- New decision recorded?  <!-- yes (see brief/08-decisions.md) / no -->

## Test plan

<!-- Mandatory. Even `npm test` counts — list it. -->

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run smoke:mcp`
- [ ] <!-- any new test or manual verification -->

## Checklist

- [ ] `CHANGELOG.md` updated under `## [Unreleased]`
- [ ] `THIRD_PARTY.md` updated if a dependency was added
- [ ] Skill lint still passes (`tests/lint/skills.test.ts`)
- [ ] No fallback chains added inside shipped skills (D-024)
- [ ] No internal LLM call introduced (D-004)
- [ ] Stdout reserved for JSON-RPC; new diagnostics go to stderr

🤖 Generated with [Claude Code](https://claude.com/claude-code)
