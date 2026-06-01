import { describe, expect, it } from "vitest";
import {
  classifyMetric,
  computeOverallVerdict,
  DEFAULT_CWV_THRESHOLDS,
} from "../../src/engine/cwv.js";
import {
  classifyEntry,
  compareToBudget,
  DEFAULT_BUDGET,
  isThirdParty,
  summarizeHar,
  type HarFile,
} from "../../src/engine/harClassifier.js";
import {
  auditPageBudgetSchema,
  auditSeoSchema,
  measureCwvSchema,
  ToolNames,
} from "../../src/schema/tools.js";

describe("v0.7 — schemas", () => {
  it("ToolNames registers three new measurement composites", () => {
    expect(ToolNames.measureCwv).toBe("measure_cwv");
    expect(ToolNames.auditPageBudget).toBe("audit_page_budget");
    expect(ToolNames.auditSeo).toBe("audit_seo");
  });

  it("measure_cwv accepts minimal input + applies thresholds defaults", () => {
    const parsed = measureCwvSchema.parse({ url: "https://example.com" });
    expect(parsed.browser).toBe("chromium");
    expect(parsed.observe_ms).toBe(5000);
    expect(parsed.close_on_finish).toBe(true);
  });

  it("measure_cwv rejects observe_ms outside [1000, 30000]", () => {
    expect(() =>
      measureCwvSchema.parse({ url: "https://example.com", observe_ms: 100 }),
    ).toThrow();
    expect(() =>
      measureCwvSchema.parse({ url: "https://example.com", observe_ms: 60000 }),
    ).toThrow();
  });

  it("audit_page_budget applies default budget on omit", () => {
    const parsed = auditPageBudgetSchema.parse({ url: "https://example.com" });
    expect(parsed.wait_for_idle_ms).toBe(2000);
    expect(parsed.browser).toBe("chromium");
  });

  it("audit_seo defaults checks=undefined (resolved to all in handler)", () => {
    const parsed = auditSeoSchema.parse({ url: "https://example.com" });
    expect(parsed.report_format).toBe("json");
    expect(parsed.checks).toBeUndefined();
  });
});

describe("v0.7 — CWV classification", () => {
  const t = DEFAULT_CWV_THRESHOLDS;

  it("classifies LCP good/needs-improvement/poor at boundary values", () => {
    expect(classifyMetric("lcp", 2000, t)).toBe("good");
    expect(classifyMetric("lcp", 2500, t)).toBe("good"); // inclusive
    expect(classifyMetric("lcp", 3000, t)).toBe("needs-improvement");
    expect(classifyMetric("lcp", 5000, t)).toBe("needs-improvement"); // exactly 2x
    expect(classifyMetric("lcp", 6000, t)).toBe("poor");
  });

  it("classifies CLS using the cls threshold (not ms)", () => {
    expect(classifyMetric("cls", 0.05, t)).toBe("good");
    expect(classifyMetric("cls", 0.1, t)).toBe("good");
    expect(classifyMetric("cls", 0.15, t)).toBe("needs-improvement");
    expect(classifyMetric("cls", 0.3, t)).toBe("poor");
  });

  it("reports INP as unmeasured when no interaction was driven", () => {
    expect(classifyMetric("inp", 0, t, false)).toBe("unmeasured");
    expect(classifyMetric("inp", 0, t, true)).toBe("good");
  });

  it("overall verdict: any poor -> fail, any nfi -> warn, all good -> pass", () => {
    expect(
      computeOverallVerdict({ lcp: "good", inp: "good", cls: "good" }),
    ).toBe("pass");
    expect(
      computeOverallVerdict({
        lcp: "good",
        inp: "needs-improvement",
        cls: "good",
      }),
    ).toBe("warn");
    expect(
      computeOverallVerdict({ lcp: "poor", inp: "good", cls: "good" }),
    ).toBe("fail");
    // unmeasured does not affect overall
    expect(
      computeOverallVerdict({ lcp: "good", inp: "unmeasured", cls: "good" }),
    ).toBe("pass");
  });
});

describe("v0.7 — HAR classifier", () => {
  it("classifies entries by MIME first, URL extension as fallback", () => {
    expect(
      classifyEntry({
        request: { url: "https://example.com/app.js" },
        response: { content: { size: 0, mimeType: "" } },
      }),
    ).toBe("js");
    expect(
      classifyEntry({
        request: { url: "https://example.com/anon" },
        response: { content: { size: 0, mimeType: "text/css" } },
      }),
    ).toBe("css");
    expect(
      classifyEntry({
        request: { url: "https://example.com/hero.webp" },
        response: { content: { size: 0, mimeType: "image/webp" } },
      }),
    ).toBe("image");
    expect(
      classifyEntry({
        request: { url: "https://example.com/font.woff2" },
        response: { content: { size: 0, mimeType: "" } },
      }),
    ).toBe("font");
    expect(
      classifyEntry({
        request: { url: "https://example.com/" },
        response: { content: { size: 0, mimeType: "text/html" } },
      }),
    ).toBe("other");
  });

  it("isThirdParty respects same-eTLD+1 heuristic", () => {
    const page = "example.com";
    expect(
      isThirdParty(
        { request: { url: "https://example.com/foo" } },
        page,
        undefined,
      ),
    ).toBe(false);
    expect(
      isThirdParty(
        { request: { url: "https://cdn.example.com/foo" } },
        page,
        undefined,
      ),
    ).toBe(false);
    expect(
      isThirdParty(
        { request: { url: "https://analytics.com/track" } },
        page,
        undefined,
      ),
    ).toBe(true);
  });

  it("isThirdParty allowlist limits to declared hostnames", () => {
    const page = "example.com";
    expect(
      isThirdParty(
        { request: { url: "https://analytics.com/track" } },
        page,
        ["googletagmanager.com"],
      ),
    ).toBe(false);
    expect(
      isThirdParty(
        { request: { url: "https://www.googletagmanager.com/gtm.js" } },
        page,
        ["googletagmanager.com"],
      ),
    ).toBe(true);
  });

  it("summarizes a HAR + flags violations beyond budget", () => {
    const har: HarFile = {
      log: {
        entries: [
          {
            request: { url: "https://example.com/" },
            response: { content: { size: 5_000, mimeType: "text/html" } },
          },
          {
            request: { url: "https://example.com/app.js" },
            response: { content: { size: 400_000, mimeType: "application/javascript" } },
          },
          {
            request: { url: "https://example.com/main.css" },
            response: { content: { size: 50_000, mimeType: "text/css" } },
          },
          {
            request: { url: "https://cdn.thirdparty.com/lib.js" },
            response: { content: { size: 300_000, mimeType: "application/javascript" } },
          },
        ],
      },
    };
    const summary = summarizeHar(har, { pageUrl: "https://example.com/" });
    expect(summary.total.requests).toBe(4);
    expect(summary.by_category.js.bytes).toBe(700_000);
    expect(summary.third_party.bytes).toBe(300_000);

    const report = compareToBudget(summary, {
      ...DEFAULT_BUDGET,
      js_kb: 300,
      third_party_kb: 200,
    });
    const cats = report.violations.map((v) => v.category);
    expect(cats).toContain("js");
    expect(cats).toContain("third_party");
    // js is 683KB vs 300KB budget -> >50% over -> fail
    expect(report.status).toBe("fail");
  });

  it("flags request_count violation independently", () => {
    const har: HarFile = {
      log: {
        entries: Array.from({ length: 12 }, (_, i) => ({
          request: { url: `https://example.com/${i}` },
          response: { content: { size: 100, mimeType: "text/plain" } },
        })),
      },
    };
    const summary = summarizeHar(har, { pageUrl: "https://example.com/" });
    const report = compareToBudget(summary, { ...DEFAULT_BUDGET, request_count: 10 });
    expect(report.violations.some((v) => v.category === "request_count")).toBe(true);
  });

  it("pass status when totals are within budget", () => {
    const har: HarFile = {
      log: {
        entries: [
          {
            request: { url: "https://example.com/" },
            response: { content: { size: 5_000, mimeType: "text/html" } },
          },
        ],
      },
    };
    const summary = summarizeHar(har, { pageUrl: "https://example.com/" });
    const report = compareToBudget(summary, DEFAULT_BUDGET);
    expect(report.status).toBe("pass");
    expect(report.violations.length).toBe(0);
  });
});
