import { describe, expect, it } from "vitest";
import { parseUiAutomator2Tree } from "../../src/engine/a11y/uiautomator2.js";

const SAMPLE_UIAUTOMATOR2 = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy index="0" rotation="0">
  <android.widget.FrameLayout resource-id="com.example:id/root" content-desc="root" text="">
    <android.widget.Button resource-id="com.example:id/login" content-desc="Login" text="Sign in" enabled="true" focused="false"/>
    <android.widget.EditText resource-id="com.example:id/email" content-desc="" text="" enabled="true" focused="true"/>
    <android.widget.Button resource-id="com.example:id/cancel" content-desc="Cancel" text="Cancel" enabled="false"/>
  </android.widget.FrameLayout>
</hierarchy>`;

describe("parseUiAutomator2Tree", () => {
  it("normalizes an Android tree and assigns refs", () => {
    const { tree, refIndex } = parseUiAutomator2Tree(SAMPLE_UIAUTOMATOR2);
    expect(refIndex.size).toBeGreaterThan(2);

    const login = findFirst(tree, (n) => n.name === "Login");
    expect(login).toBeTruthy();
    expect(login!.role).toBe("Button");

    const meta = refIndex.get(login!.ref);
    expect(meta?.kind).toBe("android");
    expect(meta?.resourceId).toBe("com.example:id/login");
    expect(meta?.contentDesc).toBe("Login");
  });

  it("records focused=true as state.focused", () => {
    const { tree } = parseUiAutomator2Tree(SAMPLE_UIAUTOMATOR2);
    const editText = findFirst(tree, (n) => n.role === "EditText");
    expect(editText?.state?.focused).toBe(true);
  });

  it("records enabled=false as state.disabled", () => {
    const { tree } = parseUiAutomator2Tree(SAMPLE_UIAUTOMATOR2);
    const cancel = findFirst(tree, (n) => n.name === "Cancel");
    expect(cancel?.state?.disabled).toBe(true);
  });

  it("simplifies android.widget.Button to Button", () => {
    const { tree, refIndex } = parseUiAutomator2Tree(SAMPLE_UIAUTOMATOR2);
    const login = findFirst(tree, (n) => n.name === "Login");
    expect(login?.role).toBe("Button");
    // raw android class kept in refIndex for selector resolution
    expect(refIndex.get(login!.ref)?.androidClass).toBe("android.widget.Button");
  });
});

function findFirst(
  root: { ref: string; name?: string; role: string; children?: unknown[]; state?: { disabled?: boolean; focused?: boolean } },
  pred: (n: { name?: string; role: string }) => boolean,
): { ref: string; name?: string; role: string; state?: { disabled?: boolean; focused?: boolean } } | null {
  if (pred(root)) return root;
  if (!root.children) return null;
  for (const c of root.children as Array<typeof root>) {
    const hit = findFirst(c, pred);
    if (hit) return hit;
  }
  return null;
}
