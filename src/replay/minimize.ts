/**
 * Classic delta-debugging minimization (`ddmin`) — Zeller & Hildebrandt,
 * 2002. Given a sequence `input` and a predicate `reproduces(subset)`
 * that returns true when the subset still triggers the target outcome,
 * returns a 1-minimal subset.
 *
 * The algorithm is bounded by `O(N log N)` predicate calls in the
 * common case and `O(N²)` in the worst case — but each call is an
 * expensive browser run, so the caller is encouraged to cap the run
 * count separately if needed.
 */
export type DdminPredicate<T> = (subset: T[]) => Promise<boolean>;

export async function ddmin<T>(input: T[], reproduces: DdminPredicate<T>): Promise<T[]> {
  let current = [...input];
  let n = 2;
  while (current.length >= 2) {
    const chunkSize = Math.max(1, Math.floor(current.length / n));
    let reduced = false;

    // Try removing each chunk (delta) one at a time.
    for (let i = 0; i < current.length; i += chunkSize) {
      const complement = [
        ...current.slice(0, i),
        ...current.slice(i + chunkSize),
      ];
      if (complement.length === 0) continue;
      if (await reproduces(complement)) {
        current = complement;
        n = Math.max(n - 1, 2);
        reduced = true;
        break;
      }
    }
    if (reduced) continue;

    // No single delta worked — increase granularity.
    if (n >= current.length) break;
    n = Math.min(n * 2, current.length);
  }
  return current;
}
