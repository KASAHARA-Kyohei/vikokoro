const assert = require("node:assert/strict");
const test = require("node:test");
const { findSpatialNeighbor } = require("../../.tmp-tests/src/editor/domain/spatialNavigation.js");

function makeLayout(entries, size = { width: 20, height: 20 }) {
  const positions = {};
  const sizes = {};
  for (const [id, point, resolvedSize] of entries) {
    positions[id] = { ...point, depth: 0 };
    sizes[id] = resolvedSize ?? size;
  }
  return { positions, sizes, contentWidth: 10000, contentHeight: 10000, offset: { x: 0, y: 0 } };
}

const aroundRoot = [
  ["root", { x: 0, y: 0 }],
  ["n", { x: 0, y: -100 }],
  ["ne", { x: 100, y: -100 }],
  ["e", { x: 100, y: 0 }],
  ["se", { x: 100, y: 100 }],
  ["s", { x: 0, y: 100 }],
  ["sw", { x: -100, y: 100 }],
  ["w", { x: -100, y: 0 }],
  ["nw", { x: -100, y: -100 }],
];

test("root navigation follows all four visual directions", () => {
  const layout = makeLayout(aroundRoot);
  assert.equal(findSpatialNeighbor(layout, "root", "left"), "w");
  assert.equal(findSpatialNeighbor(layout, "root", "down"), "s");
  assert.equal(findSpatialNeighbor(layout, "root", "up"), "n");
  assert.equal(findSpatialNeighbor(layout, "root", "right"), "e");
});

test("diagonal branches are available when no beam candidate exists", () => {
  const layout = makeLayout([
    ["root", { x: 0, y: 0 }],
    ["ne", { x: 100, y: -100 }],
  ]);
  assert.equal(findSpatialNeighbor(layout, "root", "right"), "ne");
  assert.equal(findSpatialNeighbor(layout, "root", "up"), "ne");
  assert.equal(findSpatialNeighbor(layout, "root", "left"), null);
});

test("same-direction siblings are selected by their visual order", () => {
  const layout = makeLayout([
    ["root", { x: 0, y: 0 }],
    ["top", { x: 150, y: -100 }],
    ["middle", { x: 150, y: 0 }],
    ["bottom", { x: 150, y: 100 }],
  ]);
  assert.equal(findSpatialNeighbor(layout, "root", "right"), "middle");
  assert.equal(findSpatialNeighbor(layout, "middle", "up"), "top");
  assert.equal(findSpatialNeighbor(layout, "middle", "down"), "bottom");
  assert.equal(findSpatialNeighbor(layout, "top", "down"), "middle");
});

test("beam candidates have priority over a closer diagonal candidate", () => {
  const layout = makeLayout([
    ["root", { x: 0, y: 0 }, { width: 100, height: 100 }],
    ["aligned", { x: 300, y: 40 }],
    ["diagonal", { x: 80, y: 200 }],
  ]);
  assert.equal(findSpatialNeighbor(layout, "root", "right"), "aligned");
});

test("long node rectangles participate in beam overlap", () => {
  const layout = makeLayout([
    ["root", { x: 0, y: 0 }, { width: 180, height: 34 }],
    ["long", { x: 260, y: 28 }, { width: 320, height: 74 }],
  ]);
  assert.equal(findSpatialNeighbor(layout, "root", "right"), "long");
});

test("offscreen nodes remain candidates and hidden nodes are excluded by projection", () => {
  const layout = makeLayout([
    ["root", { x: 0, y: 0 }],
    ["offscreen", { x: 5000, y: 0 }],
  ]);
  assert.equal(findSpatialNeighbor(layout, "root", "right"), "offscreen");
  const projectedLayout = makeLayout([
    ["root", { x: 0, y: 0 }],
    ["visible", { x: 100, y: 0 }],
  ]);
  assert.equal(findSpatialNeighbor(projectedLayout, "root", "right"), "visible");
});

test("no candidate returns null and ties are resolved by node ID", () => {
  assert.equal(
    findSpatialNeighbor(makeLayout([["root", { x: 0, y: 0 }]]), "root", "left"),
    null,
  );
  const tied = makeLayout([
    ["root", { x: 0, y: 0 }],
    ["b", { x: 100, y: -100 }],
    ["a", { x: 100, y: -100 }],
  ]);
  assert.equal(findSpatialNeighbor(tied, "root", "right"), "a");
});
