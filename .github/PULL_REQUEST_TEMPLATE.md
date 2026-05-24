## Summary

<!-- 1–3 bullets. What changes and why. -->

## Scope

- Layer touched: <!-- engine / tool / composite / skill / cli / build / docs -->
- Does this deviate from project conventions (no internal LLM, single-backend shipped skills, flat layout)? If yes, why?

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
