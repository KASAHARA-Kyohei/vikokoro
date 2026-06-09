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
  computeTreePositions,
  getEdgeEndpoints,
  getNodeSize,
  NODE_MAX_WIDTH,
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

test("node size keeps short text compact and expands long or multiline text", () => {
  assert.deepEqual(getNodeSize({ text: "short" }), { width: 180, height: 34 });

  const long = getNodeSize({
    text: "This is a long node label that should wrap across multiple lines without truncation.",
  });
  assert.equal(long.width, NODE_MAX_WIDTH);
  assert.equal(long.height > 34, true);

  const multiline = getNodeSize({ text: "first line\nsecond line\nthird line" });
  assert.equal(multiline.height, 74);
});

test("tree layout uses the widest node in each depth and variable node heights", () => {
  const doc = makeDoc();
  doc.nodes.root.text = "R".repeat(80);
  doc.nodes.a.text = "line 1\nline 2\nline 3";
  const positions = computeTreePositions(doc);

  assert.equal(positions.a.x, NODE_MAX_WIDTH + 80);
  assert.equal(positions.b.y >= positions.a.y + getNodeSize(doc.nodes.a).height + 16, true);
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

test("edge endpoints use each node's variable dimensions", () => {
  const endpoints = getEdgeEndpoints(
    { x: 0, y: 0 },
    { x: 500, y: 20 },
    undefined,
    { width: 320, height: 74 },
    { width: 220, height: 54 },
  );

  assert.deepEqual(endpoints.from, { x: 320, y: 37 });
  assert.deepEqual(endpoints.to, { x: 500, y: 47 });
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
    { occupied: { width: 320, height: 74 } },
    { width: 220, height: 54 },
  );
  assert.deepEqual(available, { x: 0, y: -70 });

  const snap = computeSnapAdjustment(
    [{ x: 48, y: 28, width: 100, height: 40 }],
    [{ x: 100, y: 50, width: 200, height: 80 }],
    3,
  );
  assert.deepEqual({ dx: snap.dx, dy: snap.dy }, { dx: 2, dy: 2 });
  assert.equal(snap.guides.length, 2);
});
