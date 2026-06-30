import type { DocumentState, StickyNote } from "../types";

function isFiniteStickyPosition(value: unknown): value is StickyNote["position"] {
  if (!value || typeof value !== "object") return false;
  const point = value as StickyNote["position"];
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function normalizeStickyNote(value: unknown): StickyNote | null {
  if (!value || typeof value !== "object") return null;
  const note = value as StickyNote;
  if (typeof note.id !== "string" || note.id.trim() === "") return null;
  if (typeof note.text !== "string" || note.text.trim() === "") return null;
  if (!isFiniteStickyPosition(note.position)) return null;
  return {
    id: note.id,
    text: note.text,
    position: { x: note.position.x, y: note.position.y },
  };
}

export function sanitizeStickyNotes(
  input: Pick<DocumentState, "stickyNotes">["stickyNotes"] | undefined,
): Record<string, StickyNote> {
  const result: Record<string, StickyNote> = {};
  if (!input || typeof input !== "object") return result;

  for (const value of Object.values(input)) {
    const note = normalizeStickyNote(value);
    if (!note) continue;
    result[note.id] = note;
  }

  return result;
}
