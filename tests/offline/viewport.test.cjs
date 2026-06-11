const assert = require("node:assert/strict");
const test = require("node:test");
const {
  computeCenteredScrollFromRects,
  computeInitialScrollForRoot,
  isUsableViewportSize,
  shouldResetViewportSession,
} = require("../../.tmp-tests/src/editor/domain/viewport.js");

test("shouldResetViewportSession resets only when the document session changes", () => {
  assert.equal(shouldResetViewportSession(null, "doc-1"), false);
  assert.equal(shouldResetViewportSession("doc-1", "doc-1"), false);
  assert.equal(shouldResetViewportSession("doc-1", "doc-2"), true);
  assert.equal(
    shouldResetViewportSession("doc-1:root-1", "doc-1:root-2"),
    true,
  );
});

test("isUsableViewportSize waits for a measurable viewport", () => {
  assert.equal(isUsableViewportSize({ width: 0, height: 600 }), false);
  assert.equal(isUsableViewportSize({ width: 800, height: 0 }), false);
  assert.equal(isUsableViewportSize({ width: 800, height: 600 }), true);
});

test("computeCenteredScrollFromRects centers the rendered target", () => {
  const scroll = computeCenteredScrollFromRects(
    { x: 1400, y: 600 },
    { left: 700, top: 420, width: 180, height: 34 },
    { left: 0, top: 70, width: 1200, height: 800 },
  );

  assert.deepEqual(scroll, { x: 1590, y: 567 });
});

test("computeCenteredScrollFromRects uses actual scaled dimensions", () => {
  const scroll = computeCenteredScrollFromRects(
    { x: 900, y: 500 },
    { left: 800, top: 500, width: 270, height: 51 },
    { left: 100, top: 80, width: 900, height: 600 },
  );

  assert.deepEqual(scroll, { x: 1285, y: 645.5 });
});

test("computeCenteredScrollFromRects does not return negative scroll positions", () => {
  const scroll = computeCenteredScrollFromRects(
    { x: 0, y: 0 },
    { left: 100, top: 80, width: 180, height: 34 },
    { left: 0, top: 0, width: 800, height: 600 },
  );

  assert.deepEqual(scroll, { x: 0, y: 0 });
});

test("computeInitialScrollForRoot places the root at left padding and vertical center", () => {
  const scroll = computeInitialScrollForRoot(
    { x: 100, y: 200 },
    { width: 180, height: 34 },
    { width: 800, height: 600 },
    1,
  );

  assert.deepEqual(scroll, { x: 52, y: 0 });
});

test("computeInitialScrollForRoot respects zoom", () => {
  const scroll = computeInitialScrollForRoot(
    { x: 100, y: 200 },
    { width: 180, height: 34 },
    { width: 400, height: 200 },
    2,
  );

  assert.deepEqual(scroll, { x: 152, y: 334 });
});
