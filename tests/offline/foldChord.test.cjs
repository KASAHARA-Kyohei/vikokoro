const assert = require("node:assert/strict");
const test = require("node:test");
const {
  resolveFoldChordKey,
} = require("../../.tmp-tests/src/app/keyboard/foldChord.js");

test("z starts a fold chord and known second keys resolve actions", () => {
  const start = resolveFoldChordKey(false, "z");
  assert.deepEqual(start, { handled: true, nextPending: true, action: null });

  assert.equal(resolveFoldChordKey(true, "a").action, "toggle");
  assert.equal(resolveFoldChordKey(true, "c").action, "collapse");
  assert.equal(resolveFoldChordKey(true, "o").action, "expand");
  assert.equal(resolveFoldChordKey(true, "M").action, "collapseAll");
  assert.equal(resolveFoldChordKey(true, "R").action, "expandAll");
});

test("unknown second key falls through to normal keyboard handling", () => {
  assert.deepEqual(resolveFoldChordKey(true, "j"), {
    handled: false,
    nextPending: false,
    action: null,
  });
});
