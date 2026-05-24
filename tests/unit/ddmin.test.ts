import { describe, expect, it } from "vitest";
import { ddmin } from "../../src/replay/minimize.js";

describe("ddmin", () => {
  it("returns the input when nothing can be removed", async () => {
    const reproduces = async (subset: number[]) =>
      subset.includes(1) && subset.includes(2) && subset.includes(3);
    const out = await ddmin([1, 2, 3], reproduces);
    expect(out).toEqual([1, 2, 3]);
  });

  it("strips a single irrelevant element", async () => {
    const reproduces = async (subset: number[]) => subset.includes(7);
    const out = await ddmin([1, 2, 7, 4], reproduces);
    expect(out).toEqual([7]);
  });

  it("preserves the order of surviving elements", async () => {
    const reproduces = async (subset: string[]) =>
      subset.indexOf("a") !== -1 && subset.indexOf("c") > subset.indexOf("a");
    const out = await ddmin<string>(["a", "b", "c", "d"], reproduces);
    expect(out).toEqual(["a", "c"]);
  });

  it("does not call the predicate with an empty subset", async () => {
    let sawEmpty = false;
    const reproduces = async (subset: number[]) => {
      if (subset.length === 0) sawEmpty = true;
      return subset.includes(1);
    };
    await ddmin([1, 2, 3], reproduces);
    expect(sawEmpty).toBe(false);
  });

  it("handles an already-minimal singleton", async () => {
    const reproduces = async (subset: number[]) => subset.length > 0;
    const out = await ddmin([42], reproduces);
    expect(out).toEqual([42]);
  });
});
