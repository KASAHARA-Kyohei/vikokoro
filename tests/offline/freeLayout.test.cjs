const assert = require("node:assert/strict");
const test = require("node:test");
const {
  autoLayoutBranch,
  computeSnapAdjustment,
  findAvailablePosition,
  moveNodePositions,
} = require("../../.tmp-tests/src/editor/domain/freeLayout.js");
const {
  computeLayout,
  getEdgeEndpoints,
  sanitizeNodePositions,
  svgPathForEdge,
} = require("../../.tmp-tests/src/editor/layout.js");

function makeDoc() {
  return {
    rootId: "root",
    cursorId: "a",
    nodes: {
      root: { id: "root", text: "root", parentId: null, childrenIds: ["a", "b"] },
      a: { id: "a", text: "a", parentId: "root", childrenIds: ["a1"] },
      a1: { id: "a1", text: "a1", parentId: "a", childrenIds: [] },
      b: { id: "b", text: "b", parentId: "root", childrenIds: [] },
    },
    nodePositions: {
      root: { x: -100, y: 20 },
      a: { x: 500, y: 400 },
      a1: { x: 700, y: 510 },
      b: { x: 260, y: 80 },
    },
  };
}

test("sanitizeNodePositions fills missing and removes unknown IDs", () => {
  const doc = makeDoc();
  const positions = sanitizeNodePositions(doc, {
    root: { x: -20, y: 4 },
    a: { x: Number.NaN, y: 0 },
    ghost: { x: 1, y: 2 },
  });

  assert.deepEqual(positions.root, { x: -20, y: 4 });
  assert.equal(Number.isFinite(positions.a.x), true);
  assert.equal(Boolean(positions.ghost), false);
  assert.deepEqual(Object.keys(positions).sort(), ["a", "a1", "b", "root"]);
});

test("computeLayout normalizes negative world coordinates without changing them", () => {
  const doc = makeDoc();
  const layout = computeLayout(doc);

  assert.equal(doc.nodePositions.root.x, -100);
  assert.equal(layout.positions.root.x - doc.nodePositions.root.x, layout.offset.x);
  assert.equal(layout.positions.root.y - doc.nodePositions.root.y, layout.offset.y);
  assert.equal(layout.positions.root.x > 0, true);
});

test("computeLayout keeps enough trailing canvas space to center nodes", () => {
  const doc = makeDoc();
  const layout = computeLayout(doc);
  const root = layout.positions.root;
  const viewport = { width: 1280, height: 720 };
  const desiredScroll = {
    x: root.x + 90 - viewport.width / 2,
    y: root.y + 17 - viewport.height / 2,
  };

  assert.equal(layout.contentWidth - viewport.width >= desiredScroll.x, true);
  assert.equal(layout.contentHeight - viewport.height >= desiredScroll.y, true);
});

test("autoLayoutBranch keeps branch root anchored and recalculates descendants", () => {
  const doc = makeDoc();
  const next = autoLayoutBranch(doc, "a");

  assert.deepEqual(next.a, doc.nodePositions.a);
  assert.equal(next.a1.x, next.a.x + 260);
  assert.deepEqual(next.root, doc.nodePositions.root);
});

test("edge endpoints prefer horizontal sides for ordinary parent-child links", () => {
  const horizontal = getEdgeEndpoints({ x: 0, y: 0 }, { x: 300, y: 10 });
  assert.equal(horizontal.fromSide, "right");
  assert.equal(horizontal.toSide, "left");
  assert.deepEqual(horizontal.from, { x: 180, y: 17 });
  assert.deepEqual(horizontal.to, { x: 300, y: 27 });

  const left = getEdgeEndpoints({ x: 300, y: 0 }, { x: 0, y: 40 });
  assert.equal(left.fromSide, "left");
  assert.equal(left.toSide, "right");
  assert.deepEqual(left.from, { x: 300, y: 17 });
  assert.deepEqual(left.to, { x: 180, y: 57 });
});

test("edge endpoints only use vertical sides for clearly stacked nodes", () => {
  const vertical = getEdgeEndpoints({ x: 0, y: 0 }, { x: 10, y: 200 });
  assert.equal(vertical.fromSide, "bottom");
  assert.equal(vertical.toSide, "top");
  assert.deepEqual(vertical.from, { x: 90, y: 34 });
  assert.deepEqual(vertical.to, { x: 100, y: 200 });

  const diagonal = getEdgeEndpoints({ x: 0, y: 0 }, { x: 90, y: 220 });
  assert.equal(diagonal.fromSide, "right");
  assert.equal(diagonal.toSide, "left");
  assert.deepEqual(diagonal.from, { x: 180, y: 17 });
  assert.deepEqual(diagonal.to, { x: 90, y: 237 });
});

test("manual edge anchors override automatic endpoint sides independently", () => {
  const endpoints = getEdgeEndpoints(
    { x: 0, y: 0 },
    { x: 300, y: 10 },
    { from: "top", to: "bottom" },
  );

  assert.equal(endpoints.fromSide, "top");
  assert.equal(endpoints.toSide, "bottom");
  assert.deepEqual(endpoints.from, { x: 90, y: 0 });
  assert.deepEqual(endpoints.to, { x: 390, y: 44 });
});

test("long connector curves cap their control distance", () => {
  const path = svgPathForEdge(
    { x: 180, y: 17 },
    { x: 1180, y: 17 },
    "right",
    "left",
  );

  assert.equal(path, "M 180 17 C 300 17, 1060 17, 1180 17");
});

test("moving, collision avoidance, and alignment snapping are deterministic", () => {
  const moved = moveNodePositions({ a: { x: 1, y: 2 } }, ["a"], 7, -2);
  assert.deepEqual(moved.a, { x: 8, y: 0 });

  const available = findAvailablePosition(
    { x: 0, y: 0 },
    { occupied: { x: 0, y: 0 } },
  );
  assert.notDeepEqual(available, { x: 0, y: 0 });

  const snap = computeSnapAdjustment(
    [{ x: 98, y: 48 }],
    [{ x: 100, y: 50 }],
    3,
  );
  assert.deepEqual({ dx: snap.dx, dy: snap.dy }, { dx: 2, dy: 2 });
  assert.equal(snap.guides.length, 2);
});
