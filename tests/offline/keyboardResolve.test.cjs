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
    closeConfirmOpen: false,
    focusActive: false,
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

test("r opens related-link jump from normal mode", () => {
  const resolution = resolveKeyboardCommand(baseContext(), {
    key: "r",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  });

  assert.equal(resolution.preventDefault, true);
  assert.deepEqual(resolution.command, { type: "openRelatedLinkJump" });
});

test("Ctrl+r still redoes from normal mode", () => {
  const resolution = resolveKeyboardCommand(baseContext(), {
    key: "r",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  });

  assert.equal(resolution.preventDefault, true);
  assert.deepEqual(resolution.command, { type: "appCommand", commandId: "redo" });
});


test("F enters focus and Escape exits focus", () => {
  const enter = resolveKeyboardCommand(baseContext(), {
    key: "F",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: true,
  });
  assert.deepEqual(enter.command, {
    type: "dispatch",
    action: { type: "enterFocus" },
  });

  const exit = resolveKeyboardCommand(
    { ...baseContext(), focusActive: true },
    {
      key: "Escape",
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    },
  );
  assert.deepEqual(exit.command, {
    type: "dispatch",
    action: { type: "exitFocus" },
  });
});

test("hjkl resolve to screen-direction navigation", () => {
  for (const [key, direction] of [["h", "left"], ["j", "down"], ["k", "up"], ["l", "right"]]) {
    const resolution = resolveKeyboardCommand(baseContext(), {
      key,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    });
    assert.deepEqual(resolution.command, { type: "moveCursorVisual", direction });
  }
});

test("arrow keys retain hierarchy navigation and focus parent behavior", () => {
  const arrows = [
    ["ArrowLeft", "parent"],
    ["ArrowDown", "nextSibling"],
    ["ArrowUp", "prevSibling"],
    ["ArrowRight", "child"],
  ];
  for (const [key, direction] of arrows) {
    const resolution = resolveKeyboardCommand(baseContext(), {
      key,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    });
    assert.deepEqual(resolution.command, {
      type: "dispatch",
      action: { type: "moveCursor", direction },
    });
  }

  const focusParent = resolveKeyboardCommand(
    { ...baseContext(), focusActive: true },
    {
      key: "ArrowLeft",
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    },
  );
  assert.deepEqual(focusParent.command, {
    type: "dispatch",
    action: { type: "focusParent" },
  });
});

test("Shift+HJKL and Alt+HJKL keep their editing commands", () => {
  const swap = resolveKeyboardCommand(baseContext(), {
    key: "J",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: true,
  });
  assert.deepEqual(swap.command, {
    type: "dispatch",
    action: { type: "swapSibling", direction: "down" },
  });

  const nudge = resolveKeyboardCommand(baseContext(), {
    key: "h",
    code: "KeyH",
    ctrlKey: false,
    metaKey: false,
    altKey: true,
    shiftKey: false,
  });
  assert.deepEqual(nudge.command, { type: "nudgeSelection", dx: -8, dy: 0 });
});

test("h no longer changes focus hierarchy while focus is active", () => {
  const resolution = resolveKeyboardCommand(
    { ...baseContext(), focusActive: true },
    {
      key: "h",
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    },
  );
  assert.deepEqual(resolution.command, {
    type: "moveCursorVisual",
    direction: "left",
  });
});

test("insert mode does not intercept arrows or hjkl", () => {
  for (const key of ["ArrowLeft", "ArrowRight", "h", "j", "k", "l"]) {
    const resolution = resolveKeyboardCommand({ ...baseContext(), mode: "insert" }, {
      key,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    });
    assert.equal(resolution.preventDefault, false);
    assert.deepEqual(resolution.command, { type: "none" });
  }
});

test("modified arrows remain available to the host instead of changing the cursor", () => {
  const resolution = resolveKeyboardCommand(baseContext(), {
    key: "ArrowLeft",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: true,
  });
  assert.equal(resolution.preventDefault, false);
  assert.deepEqual(resolution.command, { type: "none" });
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

test("Alt+h/j/k/l nudges positions using physical key codes", () => {
  const small = resolveKeyboardCommand(baseContext(), {
    key: "˙",
    code: "KeyH",
    ctrlKey: false,
    metaKey: false,
    altKey: true,
    shiftKey: false,
  });
  assert.deepEqual(small.command, { type: "nudgeSelection", dx: -8, dy: 0 });

  const large = resolveKeyboardCommand(baseContext(), {
    key: "Ô",
    code: "KeyJ",
    ctrlKey: false,
    metaKey: false,
    altKey: true,
    shiftKey: true,
  });
  assert.deepEqual(large.command, { type: "nudgeSelection", dx: 0, dy: 32 });
});

test("equals auto-layouts a branch and plus auto-layouts the entire map", () => {
  const branch = resolveKeyboardCommand(baseContext(), {
    key: "=",
    code: "Equal",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  });
  assert.deepEqual(branch.command, {
    type: "dispatch",
    action: { type: "autoLayout", scope: "branch" },
  });

  const all = resolveKeyboardCommand(baseContext(), {
    key: "+",
    code: "Equal",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: true,
  });
  assert.deepEqual(all.command, {
    type: "dispatch",
    action: { type: "autoLayout", scope: "all" },
  });
});

test("Command+Z and Command+Shift+Z resolve undo and redo", () => {
  const undo = resolveKeyboardCommand(baseContext(), {
    key: "z", code: "KeyZ", ctrlKey: false, metaKey: true, altKey: false, shiftKey: false,
  });
  const redo = resolveKeyboardCommand(baseContext(), {
    key: "z", code: "KeyZ", ctrlKey: false, metaKey: true, altKey: false, shiftKey: true,
  });
  assert.deepEqual(undo.command, { type: "appCommand", commandId: "undo" });
  assert.deepEqual(redo.command, { type: "appCommand", commandId: "redo" });
});

test("Cmd/Ctrl both open search, palette, and document commands", () => {
  for (const modifier of ["ctrlKey", "metaKey"]) {
    const input = { key: "f", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, [modifier]: true };
    assert.equal(resolveKeyboardCommand(baseContext(), input).command.type, "multi");
    assert.deepEqual(resolveKeyboardCommand(baseContext(), { ...input, key: "t" }).command, {
      type: "appCommand",
      commandId: "newDocument",
    });
    assert.deepEqual(resolveKeyboardCommand(baseContext(), { ...input, key: "w" }).command, {
      type: "appCommand",
      commandId: "closeDocument",
    });
  }
});
