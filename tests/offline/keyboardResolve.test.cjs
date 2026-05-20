const assert = require("node:assert/strict");
const test = require("node:test");
const { resolveKeyboardCommand } = require("../../.tmp-tests/src/app/keyboard/resolveKeyboardCommand.js");

function baseContext() {
  return {
    mode: "normal",
    helpOpen: false,
    searchOpen: false,
    paletteOpen: false,
    nodeColorOpen: false,
    nodeMemoOpen: false,
    settingsOpen: false,
    llmAssistOpen: false,
    closeConfirmOpen: false,
    jumpSession: null,
    jumpPrefix: "",
  };
}

test("m opens node memo from normal mode", () => {
  const resolution = resolveKeyboardCommand(baseContext(), {
    key: "m",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  });

  assert.equal(resolution.preventDefault, true);
  assert.equal(resolution.command.type, "multi");
  assert.deepEqual(resolution.command.commands, [
    { type: "dispatch", action: { type: "beginNoteEdit" } },
    { type: "setNodeMemoOpen", open: true },
  ]);
});

test("escape closes and commits node memo", () => {
  const resolution = resolveKeyboardCommand(
    {
      ...baseContext(),
      nodeMemoOpen: true,
    },
    {
      key: "Escape",
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    },
  );

  assert.equal(resolution.preventDefault, true);
  assert.equal(resolution.command.type, "multi");
  assert.deepEqual(resolution.command.commands, [
    { type: "dispatch", action: { type: "commitNoteEdit" } },
    { type: "setNodeMemoOpen", open: false },
  ]);
});

test("typing while node memo is open is not intercepted", () => {
  const resolution = resolveKeyboardCommand(
    {
      ...baseContext(),
      nodeMemoOpen: true,
    },
    {
      key: "a",
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    },
  );

  assert.equal(resolution.preventDefault, false);
  assert.deepEqual(resolution.command, { type: "none" });
});
