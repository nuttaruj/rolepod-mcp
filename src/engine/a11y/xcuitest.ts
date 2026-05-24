/**
 * XCUITest (iOS via Appium) accessibility-tree normalizer.
 *
 * Parses the Appium XML page source returned by
 * `driver.getPageSource()` and produces a unified `A11yNode` tree plus
 * a `refIndex` whose entries carry enough information for the engine to
 * resolve `ref → element` later (via accessibility id, name, or class
 * chain).
 *
 * Inspired by alumnium-hq/alumnium's XCUITestAccessibilityTree (MIT) —
 * see UPSTREAM_TRACKING.md. Original implementation; no verbatim copy.
 */
import { XMLParser } from "fast-xml-parser";
import type { A11yNode } from "../../schema/tools.js";

export type IosRefMeta = {
  kind: "ios";
  /** Accessibility id when present — primary locator. */
  accessibilityId?: string;
  name?: string;
  label?: string;
  type: string;
  /** 1-based class-chain index among siblings of the same `type`. */
  classChainIndex: number;
};

export type IosNormalizedSnapshot = {
  tree: A11yNode;
  refIndex: Map<string, IosRefMeta>;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  alwaysCreateTextNode: false,
  preserveOrder: true,
});

type RawNode = Record<string, RawNode[] | undefined> & { ":@"?: Record<string, string> };

export function parseXcuiTestTree(xmlString: string): IosNormalizedSnapshot {
  const refIndex = new Map<string, IosRefMeta>();
  let counter = 0;
  const nextRef = (): string => `e${++counter}`;

  let raw: RawNode[] = [];
  try {
    raw = parser.parse(xmlString) as RawNode[];
  } catch {
    raw = [];
  }

  const visit = (node: RawNode, classChainOcc: Map<string, number>): A11yNode | null => {
    const tagName = firstTagName(node);
    if (!tagName) return null;
    const attrs = node[":@"] ?? {};
    const childrenRaw = (node[tagName] as RawNode[]) ?? [];

    const idx = (classChainOcc.get(tagName) ?? 0) + 1;
    classChainOcc.set(tagName, idx);

    const ref = nextRef();
    refIndex.set(ref, {
      kind: "ios",
      accessibilityId: attrs["@name"],
      name: attrs["@name"],
      label: attrs["@label"],
      type: tagName,
      classChainIndex: idx,
    });

    const role = tagName.startsWith("XCUIElementType")
      ? tagName.slice("XCUIElementType".length).toLowerCase()
      : tagName;

    const a11y: A11yNode = { ref, role };
    const name = attrs["@label"] ?? attrs["@name"];
    if (name) a11y.name = name;
    if (attrs["@value"]) a11y.value = attrs["@value"];

    const state: A11yNode["state"] = {};
    if (attrs["@enabled"] === "false") state.disabled = true;
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

  const topLevel: A11yNode[] = [];
  const rootOcc = new Map<string, number>();
  for (const node of raw) {
    const built = visit(node, rootOcc);
    if (built) topLevel.push(built);
  }

  if (topLevel.length === 1) {
    return { tree: topLevel[0]!, refIndex };
  }
  const rootRef = nextRef();
  refIndex.set(rootRef, {
    kind: "ios",
    type: "XCUIElementTypeApplication",
    classChainIndex: 1,
  });
  const root: A11yNode = { ref: rootRef, role: "application" };
  if (topLevel.length > 0) root.children = topLevel;
  return { tree: root, refIndex };
}

function firstTagName(node: RawNode): string | null {
  for (const key of Object.keys(node)) {
    if (key === ":@") continue;
    // skip XML declarations (`<?xml ... ?>`) and processing instructions
    if (key.startsWith("?")) continue;
    return key;
  }
  return null;
}
