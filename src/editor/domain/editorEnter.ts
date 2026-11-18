export type EditorEnterState =
  | { phase: "idle" | "composing" | "imeEnterPressed" }
  | { phase: "compositionEnded"; timeStamp: number };

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
    }
  | { type: "enterKeyUp" }
  | { type: "reset" };

export type EditorEnterTransition = {
  state: EditorEnterState;
  decision: EditorEnterDecision | null;
};

export const IME_ENTER_GRACE_MS = 100;

export function createEditorEnterState(): EditorEnterState {
  return { phase: "idle" };
}

function transition(
  state: EditorEnterState,
  decision: EditorEnterDecision | null = null,
): EditorEnterTransition {
  return { state, decision };
}

function isRecentCompositionEnd(
  compositionEndedAt: number,
  enterKeyDownAt: number,
): boolean {
  const elapsed = enterKeyDownAt - compositionEndedAt;
  return elapsed >= 0 && elapsed <= IME_ENTER_GRACE_MS;
}

export function transitionEditorEnter(
  current: EditorEnterState,
  event: EditorEnterEvent,
): EditorEnterTransition {
  if (event.type === "compositionStart") {
    return transition({ phase: "composing" });
  }

  if (event.type === "compositionEnd") {
    return transition(
      current.phase === "imeEnterPressed"
        ? createEditorEnterState()
        : { phase: "compositionEnded", timeStamp: event.timeStamp },
    );
  }

  if (event.type === "enterKeyUp") {
    return transition(current.phase === "compositionEnded" ? createEditorEnterState() : current);
  }

  if (event.type === "reset") {
    return transition(createEditorEnterState());
  }

  if (event.repeat) {
    return transition(current, "ignoreEnter");
  }

  // Some IMEs send compositionend before the keydown for the same confirmation.
  if (current.phase === "compositionEnded" && isRecentCompositionEnd(current.timeStamp, event.timeStamp)) {
    return transition(createEditorEnterState(), "ignoreEnter");
  }

  if (current.phase === "composing" || event.nativeIsComposing) {
    return transition({ phase: "imeEnterPressed" }, "passToIme");
  }

  if (current.phase === "imeEnterPressed") {
    return transition(current, "ignoreEnter");
  }

  return transition(createEditorEnterState(), event.shiftKey ? "lineBreak" : "commit");
}
