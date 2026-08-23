import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEditorUiSession } from "../../src/app/session/useEditorUiSession";

describe("useEditorUiSession", () => {
  it("keeps exclusive overlays mutually exclusive", () => {
    const { result } = renderHook(() => useEditorUiSession());
    act(() => result.current.setHelpOpen(true));
    expect(result.current.helpOpen).toBe(true);
    act(() => result.current.setSettingsOpen(true));
    expect(result.current.helpOpen).toBe(false);
    expect(result.current.settingsOpen).toBe(true);
    expect(result.current.activeOverlay).toBe("settings");
  });
});
