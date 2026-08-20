const assert = require("node:assert/strict");
const test = require("node:test");
const { createSaveCoordinator } = require("../../.tmp-tests/src/persistence/saveCoordinator.js");

function workspace() {
  return { schemaVersion: 3, tabs: [], activeDocId: "doc", documents: {} };
}

test("save coordinator flushes the latest scheduled workspace", async () => {
  const saved = [];
  const coordinator = createSaveCoordinator({
    name: "tauri",
    async load() { return null; },
    async save(value) { saved.push(value); },
  }, { debounceMs: 1000 });

  coordinator.schedule(1, workspace());
  coordinator.schedule(2, { ...workspace(), activeDocId: "latest" });
  assert.equal(coordinator.getState().status, "saving");
  assert.equal(await coordinator.flush(), true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].activeDocId, "latest");
  assert.equal(coordinator.getState().lastSavedRevision, 2);
  assert.equal(coordinator.getState().status, "saved");
  coordinator.dispose();
});

test("save failure retains the pending revision and retry succeeds", async () => {
  let attempts = 0;
  const coordinator = createSaveCoordinator({
    name: "tauri",
    async load() { return null; },
    async save() {
      attempts += 1;
      if (attempts === 1) throw new Error("disk full");
    },
  }, { debounceMs: 1000 });

  coordinator.schedule(4, workspace());
  assert.equal(await coordinator.flush(), false);
  assert.equal(coordinator.getState().status, "error");
  assert.equal(coordinator.getState().pendingRevision, 4);
  assert.equal(coordinator.getState().lastSavedRevision, 0);
  assert.equal(await coordinator.retry(), true);
  assert.equal(coordinator.getState().status, "saved");
  assert.equal(coordinator.getState().lastSavedRevision, 4);
  coordinator.dispose();
});

test("unavailable repositories do not pretend to save", async () => {
  const coordinator = createSaveCoordinator({
    name: "unavailable",
    async load() { return null; },
    async save() { throw new Error("unavailable"); },
  });

  coordinator.schedule(1, workspace());
  assert.equal(coordinator.getState().status, "unavailable");
  assert.equal(await coordinator.flush(), false);
  coordinator.dispose();
});
