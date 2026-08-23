import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OnboardingGuide } from "../../src/ui/OnboardingGuide";

describe("OnboardingGuide", () => {
  it("does not show a no-op action while the central topic is already editable", () => {
    render(
      <OnboardingGuide
        language="ja"
        stage="topic"
        onAddBranch={vi.fn()}
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getByText("中央の入力欄にテーマを入力し、Enterで確定してください。")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers the branch action during the second step", async () => {
    const onAddBranch = vi.fn();
    render(
      <OnboardingGuide
        language="ja"
        stage="branch"
        onAddBranch={onAddBranch}
        onComplete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "＋で枝を追加" }));
    expect(onAddBranch).toHaveBeenCalledOnce();
  });
});
