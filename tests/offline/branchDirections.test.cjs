const assert = require("node:assert/strict");
const test = require("node:test");
const {
  BRANCH_DIRECTIONS,
  branchToneForNode,
  inferBranchDirection,
  preferredChildDirection,
  resolveDirectionPickerKey,
  sanitizeBranchDirections,
  sanitizeBranchTones,
} = require("../../.tmp-tests/src/editor/domain/branchDirections.js");
const { computeTreePositions, getNodeSize } = require("../../.tmp-tests/src/editor/layout.js");

const points = {
  n: { x: 0, y: -100 },
  ne: { x: 100, y: -100 },
  e: { x: 100, y: 0 },
  se: { x: 100, y: 100 },
  s: { x: 0, y: 100 },
  sw: { x: -100, y: 100 },
  w: { x: -100, y: 0 },
  nw: { x: -100, y: -100 },
};

test("方向キーは8方向へ割り当てられ、Escapeと修飾キーを区別する", () => {
  assert.deepEqual(
    ["w", "e", "d", "c", "x", "z", "a", "q"].map((key) => resolveDirectionPickerKey(key)),
    BRANCH_DIRECTIONS,
  );
  assert.equal(resolveDirectionPickerKey("Q"), "nw");
  assert.equal(resolveDirectionPickerKey("Escape"), "cancel");
  assert.equal(resolveDirectionPickerKey("d", true), null);
  assert.equal(resolveDirectionPickerKey("Tab"), null);
});

test("中心角度を最寄りの45度へ丸めて8方向を推定する", () => {
  for (const direction of BRANCH_DIRECTIONS) {
    assert.equal(
      inferBranchDirection({ x: 0, y: 0 }, points[direction], { width: 0, height: 0 }, { width: 0, height: 0 }),
      direction,
    );
  }
});

test("version 2相当の座標から方向を移行し、不正な保存値を除く", () => {
  const doc = {
    rootId: "root",
    nodes: {
      root: { id: "root", text: "root", parentId: null, childrenIds: ["north", "west"] },
      north: { id: "north", text: "north", parentId: "root", childrenIds: [] },
      west: { id: "west", text: "west", parentId: "root", childrenIds: [] },
    },
    nodePositions: {
      root: { x: 0, y: 0 },
      north: { x: 0, y: -200 },
      west: { x: -300, y: 0 },
    },
    cardSizes: {},
  };
  assert.deepEqual(sanitizeBranchDirections(doc, { north: "invalid", ghost: "e" }), {
    north: "n",
    west: "w",
  });
});

test("Tab方向は直近の子、自己の進行方向、東の順に継承する", () => {
  const doc = {
    rootId: "root",
    nodes: {
      root: { id: "root", parentId: null, childrenIds: ["a"] },
      a: { id: "a", parentId: "root", childrenIds: ["a1", "a2"] },
      a1: { id: "a1", parentId: "a", childrenIds: [] },
      a2: { id: "a2", parentId: "a", childrenIds: [] },
    },
    branchDirections: { a: "nw", a1: "s", a2: "sw" },
  };
  assert.equal(preferredChildDirection(doc, "a"), "sw");
  assert.equal(preferredChildDirection({ ...doc, nodes: { ...doc.nodes, a: { ...doc.nodes.a, childrenIds: [] } } }, "a"), "nw");
  assert.equal(preferredChildDirection({ rootId: "root", nodes: { root: { id: "root", parentId: null, childrenIds: [] } }, branchDirections: {} }, "root"), "e");
});

test("第一階層へ永続色を割り当て、子孫が同じ枝色を継承する", () => {
  const base = {
    rootId: "root",
    nodes: {
      root: { id: "root", parentId: null, childrenIds: ["a", "b"] },
      a: { id: "a", parentId: "root", childrenIds: ["a1"] },
      a1: { id: "a1", parentId: "a", childrenIds: [], branchTone: "rose" },
      b: { id: "b", parentId: "root", childrenIds: [] },
    },
  };
  const nodes = sanitizeBranchTones(base);
  const doc = { ...base, nodes };
  assert.equal(nodes.a.branchTone, "sky");
  assert.equal(nodes.b.branchTone, "teal");
  assert.equal(nodes.a1.branchTone, undefined);
  assert.equal(branchToneForNode(doc, "a1"), "sky");
});

test("8方向レイアウトはルートを固定し、各子を指定方向へ配置する", () => {
  const children = BRANCH_DIRECTIONS.map((direction) => `child-${direction}`);
  const nodes = {
    root: { id: "root", text: "root", parentId: null, childrenIds: children },
  };
  const branchDirections = {};
  for (const direction of BRANCH_DIRECTIONS) {
    const id = `child-${direction}`;
    nodes[id] = { id, text: direction, parentId: "root", childrenIds: [] };
    branchDirections[id] = direction;
  }
  const positions = computeTreePositions({ rootId: "root", nodes, branchDirections });
  const rootSize = getNodeSize(nodes.root);
  const rootCenter = { x: positions.root.x + rootSize.width / 2, y: positions.root.y + rootSize.height / 2 };
  assert.deepEqual(positions.root, { x: 0, y: 0 });
  for (const direction of BRANCH_DIRECTIONS) {
    const child = positions[`child-${direction}`];
    const childSize = getNodeSize(nodes[`child-${direction}`]);
    assert.equal(
      inferBranchDirection(positions.root, child, rootSize, childSize),
      direction,
    );
  }
  assert.equal(Number.isFinite(rootCenter.x + rootCenter.y), true);
});

test("同じ方向の兄弟は接線方向へ扇状配置され、互いに衝突しない", () => {
  const nodes = {
    root: { id: "root", text: "root", parentId: null, childrenIds: ["a", "b", "c"] },
    a: { id: "a", text: "a", parentId: "root", childrenIds: [] },
    b: { id: "b", text: "b", parentId: "root", childrenIds: [] },
    c: { id: "c", text: "c", parentId: "root", childrenIds: [] },
  };
  const positions = computeTreePositions({
    rootId: "root",
    nodes,
    branchDirections: { a: "e", b: "e", c: "e" },
  });
  const siblings = ["a", "b", "c"].map((id) => ({
    ...positions[id],
    ...getNodeSize(nodes[id]),
  }));
  assert.deepEqual(siblings.map((node) => node.y), [...siblings.map((node) => node.y)].sort((a, b) => a - b));
  for (let index = 1; index < siblings.length; index += 1) {
    assert.equal(siblings[index - 1].y + siblings[index - 1].height < siblings[index].y, true);
  }
});
