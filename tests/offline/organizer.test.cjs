const assert = require("node:assert/strict");
const test = require("node:test");
const { createMockThoughtOrganizer } = require("../../.tmp-tests/src/features/organizer/mockThoughtOrganizer.js");

test("mock organizer returns a suggestion without mutating cards", async () => {
  const cards = [{ id: "a", text: "原文" }, { id: "b", text: "別の原文" }];
  const before = structuredClone(cards);
  const suggestion = await createMockThoughtOrganizer().organize({ cards, instruction: "まとめる" });
  assert.deepEqual(cards, before);
  assert.deepEqual(suggestion.groups, [{ title: "整理案", cardIds: ["a", "b"] }]);
});
