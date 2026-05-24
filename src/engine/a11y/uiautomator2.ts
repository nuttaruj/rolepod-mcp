/**
 * UIAutomator2 (Android via Appium) accessibility-tree normalizer.
 *
 * Parses the Appium XML page source returned by
 * `driver.getPageSource()`. UIAutomator2 markup is rooted at
 * `<hierarchy>` and uses Android class names as tag names
 * (e.g. `android.widget.Button`), with attributes such as
 * `resource-id`, `content-desc`, `text`, `bounds`, `enabled`, etc.
 *
 * Inspired by alumnium-hq/alumnium's UIAutomator2AccessibilityTree
 * (MIT) — see UPSTREAM_TRACKING.md. Original implementation; no
 * verbatim copy.
 */
import { XMLParser } from "fast-xml-parser";
import type { A11yNode } from "../../schema/tools.js";

export type AndroidRefMeta = {
  kind: "android";
  resourceId?: string;
  contentDesc?: string;
  text?: string;
  androidClass: string;
  /** 1-based index among siblings of the same android class. */
  classIndex: number;
};

export type AndroidNormalizedSnapshot = {
  tree: A11yNode;
  refIndex: Map<string, AndroidRefMeta>;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  alwaysCreateTextNode: false,
  preserveOrder: true,
});

type RawNode = Record<string, RawNode[] | undefined> & { ":@"?: Record<string, string> };

export function parseUiAutomator2Tree(xmlString: string): AndroidNormalizedSnapshot {
  const refIndex = new Map<string, AndroidRefMeta>();
  let counter = 0;
  const nextRef = (): string => `e${++counter}`;

  let raw: RawNode[] = [];
  try {
    raw = parser.parse(xmlString) as RawNode[];
  } catch {
    raw = [];
  }

  const visit = (node: RawNode, siblingOcc: Map<string, number>): A11yNode | null => {
    const tagName = firstTagName(node);
    if (!tagName) return null;
    const attrs = node[":@"] ?? {};
    const childrenRaw = (node[tagName] as RawNode[]) ?? [];

    const idx = (siblingOcc.get(tagName) ?? 0) + 1;
    siblingOcc.set(tagName, idx);

    const ref = nextRef();
    refIndex.set(ref, {
      kind: "android",
      resourceId: attrs["@resource-id"],
      contentDesc: attrs["@content-desc"],
      text: attrs["@text"],
      androidClass: tagName,
      classIndex: idx,
    });

    const role = simplifyAndroidClass(tagName);

    const a11y: A11yNode = { ref, role };
    const name = attrs["@content-desc"] ?? attrs["@text"];
    if (name) a11y.name = name;
    if (attrs["@text"] && attrs["@text"] !== name) a11y.value = attrs["@text"];

    const state: A11yNode["state"] = {};
    if (attrs["@enabled"] === "false") state.disabled = true;
    if (attrs["@focused"] === "true") state.focused = true;
    if (attrs["@selected"] === "true") state.selected = true;
    if (Object.keys(state).length > 0) a11y.state = state;

    if (childrenRaw.length > 0) {
      const siblings = new Map<string, number>();
      const children: A11yNode[] = [];
      for (const child of childrenRaw) {
        const built = visit(child, siblings);
        if (built) children.push(built);
      }
      if (children.length > 0) a11y.children = children;
    }
    return a11y;
  };

  const hierarchy =
    raw.find((n) => Object.keys(n).some((k) => k === "hierarchy")) ?? raw[0];
  if (!hierarchy) {
    return {
      tree: { ref: "e0", role: "RootWebArea" },
      refIndex,
    };
  }
  const top = visit(hierarchy, new Map());
  if (top) return { tree: top, refIndex };
  return { tree: { ref: "e0", role: "RootWebArea" }, refIndex };
}

function firstTagName(node: RawNode): string | null {
  for (const key of Object.keys(node)) {
    if (key !== ":@") return key;
  }
  return null;
}

/** Map `android.widget.Button` → `Button`, fall back to the full class. */
function simplifyAndroidClass(cls: string): string {
  const last = cls.split(".").pop();
  return last ?? cls;
}
