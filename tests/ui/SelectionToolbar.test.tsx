import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SelectionToolbar } from "../../src/ui/SelectionToolbar";

const noop = () => undefined;

describe("SelectionToolbar", () => {
  it("exposes mouse actions for a selected node", async () => {
    const onAddChild = vi.fn();
    render(
      <SelectionToolbar
        language="ja"
        position={{ left: 0, top: 0 }}
        multiCount={1}
        isRoot={false}
        menuOpen={false}
        onAddChild={onAddChild}
        onAddSibling={noop}
        onEdit={noop}
        onToggleMenu={noop}
        onMemo={noop}
        onColor={noop}
        onDuplicate={noop}
        onToggleCollapse={noop}
        onFocus={noop}
        onDelete={noop}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "8方向へ子を追加" }));
    expect(onAddChild).toHaveBeenCalledOnce();
  });
});
