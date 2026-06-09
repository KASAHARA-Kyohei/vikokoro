export type EditorEnterPhase =
  | "idle"
  | "composing"
  | "imeEnterPressed"
  | "awaitingCushion"
  | "awaitingCommit";

export type EditorEnterState = {
  phase: EditorEnterPhase;
  compositionEndedAt: number | null;
};

export type EditorEnterDecision =
  | "passToIme"
  | "lineBreak"
  | "commit"
  | "ignoreEnter";

export type EditorEnterEvent =
  | { type: "compositionStart" }
  | { type: "compositionEnd"; timeStamp: number }
  | {
      type: "enterKeyDown";
      timeStamp: number;
      shiftKey: boolean;
      repeat: boolean;
      nativeIsComposing: boolean;
      keyCode: number;
    }
  | { type: "enterKeyUp" }
  | { type: "reset" };

export type EditorEnterTransition = {
  state: EditorEnterState;
  decision: EditorEnterDecision | null;
};

export const IME_ENTER_GRACE_MS = 100;

export function createEditorEnterState(): EditorEnterState {
  return { phase: "idle", compositionEndedAt: null };
}

function transition(
  state: EditorEnterState,
  decision: EditorEnterDecision | null = null,
): EditorEnterTransition {
  return { state, decision };
}

function isRecentCompositionEnd(
  compositionEndedAt: number | null,
  enterKeyDownAt: number,
): boolean {
  if (compositionEndedAt === null) return false;
  const elapsed = enterKeyDownAt - compositionEndedAt;
  return elapsed >= 0 && elapsed <= IME_ENTER_GRACE_MS;
}

export function transitionEditorEnter(
  current: EditorEnterState,
  event: EditorEnterEvent,
): EditorEnterTransition {
  if (event.type === "compositionStart") {
    return transition({ phase: "composing", compositionEndedAt: null });
  }

  if (event.type === "compositionEnd") {
    return transition({
      phase:
        current.phase === "imeEnterPressed"
          ? "awaitingCommit"
          : "awaitingCushion",
      compositionEndedAt:
        current.phase === "imeEnterPressed" ? null : event.timeStamp,
    });
  }

  if (event.type === "enterKeyUp") {
    return transition(current);
  }

  if (event.type === "reset") {
    return transition(createEditorEnterState());
  }

  if (event.repeat) {
    return transition(current, "ignoreEnter");
  }

  if (current.phase === "composing" || event.nativeIsComposing) {
    return transition(
      { phase: "imeEnterPressed", compositionEndedAt: null },
      "passToIme",
    );
  }

  if (current.phase === "imeEnterPressed") {
    return transition(current, "ignoreEnter");
  }

  if (current.phase === "awaitingCushion") {
    if (isRecentCompositionEnd(current.compositionEndedAt, event.timeStamp)) {
      return transition(
        { phase: "awaitingCommit", compositionEndedAt: null },
        "ignoreEnter",
      );
    }
    if (event.shiftKey) {
      return transition(current, "lineBreak");
    }
    return transition(
      { phase: "awaitingCommit", compositionEndedAt: null },
      "ignoreEnter",
    );
  }

  if (current.phase === "awaitingCommit") {
    if (event.shiftKey) {
      return transition(current, "lineBreak");
    }
    return transition(createEditorEnterState(), "commit");
  }

  if (event.shiftKey) {
    return transition(current, "lineBreak");
  }

  // keyCode 229 can remain after composition on Windows. The edit-session
  // phase, rather than keyCode alone, determines whether Enter is consumed.
  return transition(createEditorEnterState(), "commit");
}
