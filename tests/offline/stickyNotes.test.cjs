const assert = require("node:assert/strict");
const test = require("node:test");
const { sanitizeStickyNotes } = require("../../.tmp-tests/src/editor/domain/stickyNotes.js");

test("sanitizeStickyNotes: drops invalid notes", () => {
  const sanitized = sanitizeStickyNotes({
    note1: { id: "note1", text: "valid", position: { x: 12, y: -4 } },
    emptyId: { id: "", text: "valid", position: { x: 0, y: 0 } },
    emptyText: { id: "emptyText", text: "   ", position: { x: 0, y: 0 } },
    nanX: { id: "nanX", text: "valid", position: { x: Number.NaN, y: 0 } },
    missingPosition: { id: "missingPosition", text: "valid" },
    nonObject: null,
  });

  assert.deepEqual(sanitized, {
    note1: { id: "note1", text: "valid", position: { x: 12, y: -4 } },
  });
});

test("sanitizeStickyNotes: normalizes by note id", () => {
  const sanitized = sanitizeStickyNotes({
    wrongKey: { id: "note1", text: "valid", position: { x: 1, y: 2 } },
  });

  assert.deepEqual(Object.keys(sanitized), ["note1"]);
});
