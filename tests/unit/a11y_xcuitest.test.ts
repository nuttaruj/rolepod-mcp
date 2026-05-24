import { describe, expect, it } from "vitest";
import { parseXcuiTestTree } from "../../src/engine/a11y/xcuitest.js";

const SAMPLE_XCUITEST = `<?xml version="1.0" encoding="UTF-8"?>
<XCUIElementTypeApplication name="MyApp" label="MyApp" enabled="true">
  <XCUIElementTypeWindow>
    <XCUIElementTypeButton name="login-btn" label="Login" value="" enabled="true"/>
    <XCUIElementTypeTextField name="email-field" label="Email" value=""/>
    <XCUIElementTypeButton name="login-btn" label="Login" value="" enabled="false"/>
  </XCUIElementTypeWindow>
</XCUIElementTypeApplication>`;

describe("parseXcuiTestTree", () => {
  it("normalizes a simple iOS tree and assigns stable refs", () => {
    const { tree, refIndex } = parseXcuiTestTree(SAMPLE_XCUITEST);
    expect(tree.role).toBe("application");
    expect(tree.children?.length).toBeGreaterThan(0);
    expect(refIndex.size).toBeGreaterThan(2);

    const loginBtn = findFirst(tree, (n) => n.name === "Login");
    expect(loginBtn).toBeTruthy();
    expect(loginBtn!.role.toLowerCase()).toContain("button");

    const meta = refIndex.get(loginBtn!.ref);
    expect(meta?.kind).toBe("ios");
    expect(meta?.accessibilityId).toBe("login-btn");
  });

  it("records class-chain index for duplicate-typed siblings", () => {
    const { tree, refIndex } = parseXcuiTestTree(SAMPLE_XCUITEST);
    const buttons = findAll(tree, (n) => n.role.toLowerCase().includes("button"));
    expect(buttons.length).toBe(2);
    const indexes = buttons.map((b) => refIndex.get(b.ref)?.classChainIndex);
    expect(indexes).toContain(1);
    expect(indexes).toContain(2);
  });

  it("flags enabled=false as state.disabled", () => {
    const { tree } = parseXcuiTestTree(SAMPLE_XCUITEST);
    const buttons = findAll(tree, (n) => n.role.toLowerCase().includes("button"));
    const disabled = buttons.find((b) => b.state?.disabled === true);
    expect(disabled).toBeTruthy();
  });

  it("falls back to an application root when XML is empty", () => {
    const { tree, refIndex } = parseXcuiTestTree("");
    expect(tree.role).toBe("application");
    expect(refIndex.size).toBeGreaterThanOrEqual(0);
  });
});

function findFirst(
  root: { ref: string; name?: string; role: string; children?: unknown[]; state?: unknown },
  pred: (n: { name?: string; role: string }) => boolean,
): { ref: string; name?: string; role: string; state?: { disabled?: boolean } } | null {
  if (pred(root)) return root as { ref: string; name?: string; role: string };
  if (!root.children) return null;
  for (const c of root.children as Array<{
    ref: string;
    name?: string;
    role: string;
    children?: unknown[];
  }>) {
    const hit = findFirst(c, pred);
    if (hit) return hit;
  }
  return null;
}

function findAll(
  root: { ref: string; name?: string; role: string; children?: unknown[]; state?: { disabled?: boolean } },
  pred: (n: { name?: string; role: string }) => boolean,
): Array<{ ref: string; name?: string; role: string; state?: { disabled?: boolean } }> {
  const acc: Array<{ ref: string; name?: string; role: string; state?: { disabled?: boolean } }> = [];
  const visit = (n: typeof root) => {
    if (pred(n)) acc.push(n);
    if (n.children) {
      for (const c of n.children as Array<typeof root>) visit(c);
    }
  };
  visit(root);
  return acc;
}
