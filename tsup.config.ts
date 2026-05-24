import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "bin/rolepod-mcp": "bin/rolepod-mcp.ts",
  },
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  dts: true,
  sourcemap: true,
  splitting: false,
  shims: false,
  // Keep all third-party packages as runtime imports so:
  //  - optional deps (webdriverio) don't get pulled into the static bundle
  //  - users can swap pinned versions without rebuilding
  noExternal: [],
  external: [
    "@modelcontextprotocol/sdk",
    "playwright",
    "playwright-core",
    "@axe-core/playwright",
    "axe-core",
    "pixelmatch",
    "pngjs",
    "js-yaml",
    "fast-xml-parser",
    "zod",
    "webdriverio",
    "@wdio/types",
  ],
});
