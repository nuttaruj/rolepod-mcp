# Security Policy

## Supported versions

rolepod-mcp follows the brief's pre-1.0 versioning policy (see
`brief/03-tool-surface.md → Versioning`). Until v1.0, only the **most
recent minor release** is supported for security fixes. After v1.0,
the most recent two minor releases will receive backports.

| Version | Supported |
|---|---|
| 0.3.x (current) | ✓ |
| 0.2.x | best-effort |
| 0.1.x | no |

## Reporting a vulnerability

**Do not open a public GitHub issue.**

Please report security issues privately via GitHub Security Advisories:

1. Go to <https://github.com/nuttaruj/rolepod-mcp/security/advisories>.
2. Click **Report a vulnerability**.
3. Provide:
   - A description of the issue.
   - Reproduction steps (a failing test or a minimal `replay.json`
     bundle is ideal).
   - Affected version(s).
   - Any suggested mitigation.

If GitHub Security Advisories is unavailable to you, email
**security@rolepod.dev** with the same details.

## Response timeline

- **Acknowledgement:** within 7 days.
- **Triage decision:** within 14 days.
- **Fix or mitigation:** released as a patch version on `main` as
  soon as a working fix is verified. Aim ≤ 30 days for high
  severity, ≤ 90 days for medium, best-effort for low.

## Scope

In scope:

- The MCP server runtime (`src/`, `bin/`).
- Shipped skills (`skills/*/SKILL.md`).
- The plugin manifests.
- Build artifacts published to npm under `@rolepod/mcp`.

Out of scope:

- Vulnerabilities in upstream dependencies (`playwright`,
  `@axe-core/playwright`, `webdriverio`, etc.) — report those to the
  upstream maintainers. We will update the affected dependency
  promptly once a fix ships.
- Misuse of the MCP server by an authenticated local user — the
  server explicitly runs as the user and inherits their browser
  permissions (see `brief/02-architecture.md → Security model`).
- Findings that require modification of the user's local environment
  (`~/.cursor/mcp.json`, `~/.claude/`) to exploit.

## Hardening commitments

- No telemetry, ever (D-013).
- No network exposure by default — stdio transport only. SSE
  transport is opt-in and binds to localhost.
- Artifacts are written under `./.rolepod-mcp/` in the current
  working directory; no system-wide writes.

## Disclosure

We follow coordinated disclosure. Once a fix ships, we credit the
reporter (unless they prefer anonymity) in the CHANGELOG and the
advisory.
