# 07 — Install & Usage UX

> **Distribution model:** rolepod-mcp ships as a **plugin** (skills + MCP server bundled), not as a bare MCP server. The primary install path is the CLI's plugin marketplace; an npm-only install path exists for non-plugin-aware tooling. See `11-plugin-skills.md` for the plugin layout.

The install flow has to work for three personas with very different starting points. Each path should converge on the same end state: the plugin's skills are available to the Lead, the MCP server is registered, and a smoke test confirms it.

## End state

A successful install means:

1. The plugin manifest is loaded by the CLI; skills (`/verify-ui`, etc.) appear in the available skill list.
2. The bundled MCP server is registered with the CLI (the plugin manifest declares this — no separate `mcp add` step needed).
3. Required platform deps are installed: Playwright browsers for web; Appium drivers + SDKs for mobile (only if requested).
4. A 30-second smoke test confirms the registration works.

## Persona 1 — rolepod plugin user (web only)

Already has the rolepod markdown plugin installed in Claude Code (or Codex, Cursor, Gemini). Wants UI verification to start working.

**Preferred install path — plugin marketplace:**

```bash
# Claude Code
claude plugin marketplace add nuttaruj/rolepod-mcp
claude plugin install rolepod-mcp@rolepod-mcp

# Cursor, Codex, Gemini — analogous commands per CLI

# After install, all four skills (/verify-ui, /audit-a11y, /visual-diff, /scaffold-e2e) are available
# and the MCP server is registered automatically via the plugin manifest.
```

**Alternative — npm + manual MCP register** (for tooling without plugin support):

```bash
npm i -g @rolepod/mcp
npx -y @rolepod/mcp install:browsers
claude mcp add rolepod -- npx -y @rolepod/mcp
```

This path installs the MCP server but does NOT install skills. Use only when the CLI lacks plugin support.

Or — preferred — interactive from rolepod's existing `bootstrap.sh`:

```bash
$ cd /Users/you/Project/rolepod
$ ./bootstrap.sh

[rolepod] Markdown plugin installed.
[rolepod] Optional: install rolepod-mcp for UI verification? [y/N]
> y
[rolepod-mcp] Installing @rolepod/mcp globally via npm...
[rolepod-mcp] Installing Playwright Chromium...
[rolepod-mcp] Registering with Claude Code...
[rolepod-mcp] Smoke test... ✓
[rolepod-mcp] Done. Try /check-work on a UI change.
```

This is the path most rolepod users take. It is silent on success and verbose on failure.

## Persona 2 — mobile tester

Wants iOS or Android automation. Has already done Persona 1 install OR wants both at once.

```bash
# Same as persona 1, plus:
npx -y @rolepod/mcp install:mobile

# Interactive — asks per-platform:
[rolepod-mcp] iOS setup detected: Xcode 15.4, simulator iPhone 15
[rolepod-mcp] Install Appium XCUITest driver? [y/N] y
[rolepod-mcp] Installing appium and @appium/xcuitest-driver...
[rolepod-mcp] iOS ready.

[rolepod-mcp] Android setup detected: SDK at $ANDROID_HOME, emulator Pixel_7
[rolepod-mcp] Install Appium UIAutomator2 driver? [y/N] y
[rolepod-mcp] Installing @appium/uiautomator2-driver...
[rolepod-mcp] Android ready.

[rolepod-mcp] Done. Try a mobile session in your CLI.
```

The install flow detects what's already set up and skips installed components. It refuses to overwrite anything.

### Required system prereqs (out of scope to install)

The install command checks for these and tells the user how to get them — but does not install them:

| Platform | Prereq |
|---|---|
| iOS | Xcode + Command Line Tools + at least one Simulator |
| Android | Android Studio SDK + `$ANDROID_HOME` + at least one AVD |
| Web | nothing — Playwright bundles Chromium |

If a prereq is missing, the installer prints a copy-pasteable hint and exits with code 1.

## Persona 3 — independent / CI user

Doesn't use rolepod at all. Wants a multi-platform UI automation MCP server.

```bash
# Install
npm i -g @rolepod/mcp

# Use with any MCP-capable client
# stdio:
my-agent-cli mcp add rolepod -- npx -y @rolepod/mcp

# SSE (if the client prefers):
npx -y @rolepod/mcp --transport sse --port 9876
```

For CI:

```yaml
# .github/workflows/e2e-ai.yml
- uses: actions/setup-node@v4
  with:
    node-version: 20
- run: npm i -g @rolepod/mcp
- run: npx -y @rolepod/mcp install:browsers
- run: |
    # Your CI script that uses an MCP-capable agent to drive rolepod-mcp
```

A Docker image is published at `ghcr.io/nuttaruj/rolepod-mcp` with web preconfigured. Mobile in Docker is intentionally not supported (iOS impossible; Android requires KVM and is fragile).

## Environment variables (full list)

| Variable | Purpose | Default |
|---|---|---|
| `ROLEPOD_MCP_WEB_ENGINE` | Force web engine choice | `playwright` |
| `ROLEPOD_MCP_HEADLESS` | Force headless mode for all sessions | `false` on dev, `true` in CI (auto-detected) |
| `ROLEPOD_MCP_ARTIFACT_DIR` | Override artifact root | `./.rolepod-mcp/artifacts` |
| `ROLEPOD_MCP_IDLE_TIMEOUT_MS` | Session idle close | `300000` (5 min) |
| `ROLEPOD_MCP_DISABLED` | Disable the server (it exits immediately) | unset |
| `ROLEPOD_MCP_LOG` | Log level: `silent | error | warn | info | debug` | `warn` |
| `ROLEPOD_MCP_REPLAY_DIR` | Where replay bundles are saved | `<artifact_dir>/replay` |
| `APPIUM_SERVER_URL` | Use external Appium server instead of spawning | unset (spawn) |
| `PLAYWRIGHT_BROWSERS_PATH` | Standard Playwright override | follows Playwright default |

No env var is required for normal use.

## First-run experience

The first invocation of `rolepod-mcp` (after install) does these checks and prints results:

```
[rolepod-mcp v0.1.0]
✓ Node 20.11.0
✓ Playwright Chromium 124.0
- iOS driver: not installed (run `rolepod-mcp install:mobile` to enable)
- Android driver: not installed (run `rolepod-mcp install:mobile` to enable)
✓ Artifact dir: ./.rolepod-mcp/artifacts (writable)
✓ MCP stdio transport ready

Listening for MCP messages on stdin...
```

If the server is being launched by an MCP client (stdio), the user never sees this output — but it's still useful when debugging.

## Smoke test

A built-in smoke test verifies the install:

```bash
$ rolepod-mcp smoke

[smoke] opening https://example.com via Chromium…
[smoke] snapshot: 14 nodes
[smoke] clicking "More information…"
[smoke] navigated to https://www.iana.org/help/example-domains
[smoke] PASS in 1.8s
```

This runs without any AI agent — useful for confirming the install before debugging an agent integration.

## Uninstall

```bash
# Unregister from CLI
claude mcp remove rolepod

# Remove the global package
npm uninstall -g @rolepod/mcp

# Clean artifacts
rm -rf .rolepod-mcp/artifacts
```

The Playwright browser cache (`~/Library/Caches/ms-playwright/`) is shared with other tools; the uninstaller leaves it alone.

## Compatibility matrix

| Component | Min version | Tested up to |
|---|---|---|
| Node.js | 20.x | 22.x |
| Playwright | 1.42 | latest |
| Appium | 2.5 | 2.x latest |
| iOS | 16.4 | 17.x |
| Android | 11 (API 30) | 14 (API 34) |
| macOS | 13 (Ventura) | 14 (Sonoma) |
| Linux | Ubuntu 22.04 | 24.04 |
| Windows | 11 (web only) | — (mobile unsupported) |

iOS automation requires macOS. This is an Apple constraint.

## Troubleshooting paths

The installer and `rolepod-mcp doctor` produce diagnostics for common failure modes:

| Symptom | Diagnostic | Fix |
|---|---|---|
| `Playwright browsers not found` | run `rolepod-mcp install:browsers` |
| `Appium server failed to start` | check `appium --version` and Node compatibility |
| `Xcode license not accepted` | print the exact `sudo xcodebuild -license accept` command |
| `Android SDK not on PATH` | print the export commands for `$ANDROID_HOME` |
| `MCP tool list empty` | confirm the CLI's `mcp list` output; show the `claude mcp add` command again |

These are surfaced from a `doctor` subcommand the user can run anytime:

```bash
rolepod-mcp doctor
```

## Plug-in to rolepod's existing `install.sh`

The parent rolepod `install.sh` is 69KB of bash. We **do not** add rolepod-mcp as a hard step in it. Instead:

- `install.sh` finishes its existing job (markdown plugin install).
- `bootstrap.sh` (the higher-level orchestrator) gains an optional prompt — described in Persona 1 above.
- A new short script `bootstrap-mcp.sh` lives in rolepod-mcp and does the install end-to-end. The parent `bootstrap.sh` calls it if the user said yes.

The parent install never depends on rolepod-mcp succeeding.
