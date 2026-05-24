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
});
