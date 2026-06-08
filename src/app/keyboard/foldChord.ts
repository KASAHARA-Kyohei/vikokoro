export type FoldChordAction =
  | "toggle"
  | "collapse"
  | "expand"
  | "collapseAll"
  | "expandAll";

export type FoldChordResolution = {
  handled: boolean;
  nextPending: boolean;
  action: FoldChordAction | null;
};

const ACTIONS: Record<string, FoldChordAction> = {
  a: "toggle",
  c: "collapse",
  o: "expand",
  M: "collapseAll",
  R: "expandAll",
};

export function resolveFoldChordKey(
  pending: boolean,
  key: string,
): FoldChordResolution {
  if (!pending) {
    return key === "z"
      ? { handled: true, nextPending: true, action: null }
      : { handled: false, nextPending: false, action: null };
  }

  const action = ACTIONS[key] ?? null;
  if (!action) {
    return { handled: false, nextPending: false, action: null };
  }
  return { handled: true, nextPending: false, action };
}
