import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";

const native = vi.hoisted(() => ({
  save: vi.fn(),
  destroy: vi.fn(),
  onCloseRequested: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => native,
}));
vi.mock("../../src/persistence/tauriWorkspaceRepository", () => ({
  createTauriWorkspaceRepository: () => ({
    name: "tauri",
    load: async () => ({ kind: "empty" }),
    save: native.save,
  }),
}));

async function requestClose() {
  await waitFor(() => expect(native.onCloseRequested).toHaveBeenCalled());
  const handler = native.onCloseRequested.mock.lastCall![0];
  const preventDefault = vi.fn();
  await act(async () => handler({ preventDefault }));
  expect(preventDefault).toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.setItem("vikokoro.onboarding.v1", "complete");
  native.onCloseRequested.mockResolvedValue(vi.fn());
  native.save.mockResolvedValue(undefined);
  native.destroy.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("app window closing", () => {
  it("saves the current workspace before closing", async () => {
    render(<App />);
    await requestClose();
    await waitFor(() => expect(native.destroy).toHaveBeenCalledOnce());
    expect(native.save).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("allows retrying after a Windows save error", async () => {
    const user = userEvent.setup();
    native.save.mockRejectedValue(new Error("Access is denied. (os error 5)"));
    render(<App />);
    await requestClose();
    expect(await screen.findByRole("dialog")).toHaveTextContent("os error 5");
    expect(native.destroy).not.toHaveBeenCalled();
    native.save.mockResolvedValue(undefined);
    await user.click(screen.getByRole("button", { name: "保存して終了を再試行" }));
    await waitFor(() => expect(native.destroy).toHaveBeenCalledOnce());
  });

  it("lets the user cancel or explicitly close without saving", async () => {
    const user = userEvent.setup();
    native.save.mockRejectedValue(new Error("Access is denied. (os error 5)"));
    render(<App />);
    await requestClose();
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "編集に戻る" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(native.destroy).not.toHaveBeenCalled();
    await requestClose();
    await screen.findByRole("dialog");
    const saveAttempts = native.save.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "保存せず終了" }));
    await waitFor(() => expect(native.destroy).toHaveBeenCalledOnce());
    expect(native.save.mock.calls.length).toBe(saveAttempts);
  });

  it("recovers the close controls when destroying the window fails", async () => {
    const user = userEvent.setup();
    native.destroy.mockRejectedValueOnce(new Error("window could not be destroyed"));
    render(<App />);
    await requestClose();
    expect(await screen.findByRole("dialog")).toHaveTextContent("window could not be destroyed");
    await user.click(screen.getByRole("button", { name: "保存して終了を再試行" }));
    await waitFor(() => expect(native.destroy).toHaveBeenCalledTimes(2));
  });
});
