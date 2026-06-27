const assert = require("node:assert/strict");
const test = require("node:test");
const {
  canCreateCustomLink,
  makeCustomLinkId,
  sanitizeCustomLinks,
} = require("../../.tmp-tests/src/editor/domain/customLinks.js");

function makeDoc() {
  return {
    nodes: {
      root: { id: "root", text: "root", parentId: null, childrenIds: ["a", "b"] },
      a: { id: "a", text: "a", parentId: "root", childrenIds: ["a1"] },
      a1: { id: "a1", text: "a1", parentId: "a", childrenIds: [] },
      b: { id: "b", text: "b", parentId: "root", childrenIds: [] },
    },
    customLinks: {},
  };
}

test("makeCustomLinkId is directionless", () => {
  assert.equal(makeCustomLinkId("b", "a1"), "a1<->b");
  assert.equal(makeCustomLinkId("a1", "b"), "a1<->b");
});

test("sanitizeCustomLinks keeps valid unique non-tree links only", () => {
  const sanitized = sanitizeCustomLinks(makeDoc(), {
    good: { id: "good", fromId: "b", toId: "a1" },
    duplicate: { id: "duplicate", fromId: "a1", toId: "b" },
    self: { id: "self", fromId: "a", toId: "a" },
    tree: { id: "tree", fromId: "root", toId: "a" },
    missing: { id: "missing", fromId: "a", toId: "ghost" },
  });

  assert.deepEqual(sanitized, {
    "a1<->b": { id: "a1<->b", fromId: "a1", toId: "b" },
  });
});

test("canCreateCustomLink rejects existing, self, missing, and parent-child pairs", () => {
  const doc = makeDoc();
  doc.customLinks = {
    "a1<->b": { id: "a1<->b", fromId: "a1", toId: "b" },
  };

  assert.equal(canCreateCustomLink(doc, "a", "a"), false);
  assert.equal(canCreateCustomLink(doc, "a", "ghost"), false);
  assert.equal(canCreateCustomLink(doc, "root", "a"), false);
  assert.equal(canCreateCustomLink(doc, "b", "a1"), false);
});
