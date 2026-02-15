import { useEffect, useMemo, useState } from "react";
import type { LlmImprovePreview } from "../../features/llm/preview";
import "./LlmAssistModal.scss";

export type LlmAssistMode = "generate" | "improve";

type Props = {
  open: boolean;
  mode: LlmAssistMode;
  running: boolean;
  errorMessage: string | null;
  improvePreview: LlmImprovePreview | null;
  onChangeMode: (mode: LlmAssistMode) => void;
  onRun: (input: string) => Promise<void>;
  onApplyImprovePreview: () => void;
  onClearImprovePreview: () => void;
  onClose: () => void;
};

function defaultInputFor(mode: LlmAssistMode): string {
  if (mode === "generate") return "生成AIを使った業務改善";
  return "漏れを補完し、実行可能な粒度にする";
}

export function LlmAssistModal({
  open,
  mode,
  running,
  errorMessage,
  improvePreview,
  onChangeMode,
  onRun,
  onApplyImprovePreview,
  onClearImprovePreview,
  onClose,
}: Props) {
  const [input, setInput] = useState(defaultInputFor(mode));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setInput(defaultInputFor(mode));
    setLocalError(null);
  }, [open, mode]);

  const label = useMemo(() => {
    if (mode === "generate") {
      return {
        title: "LLM Generate",
        promptLabel: "Topic",
        placeholder: "例: 新規事業アイデアの整理",
        runLabel: "Generate",
      };
    }
    return {
      title: "LLM Improve",
      promptLabel: "Goal",
      placeholder: "例: 漏れを補完し、実行ステップを追加",
      runLabel: "Improve",
    };
  }, [mode]);

  const groupedChanges = useMemo(() => {
    if (!improvePreview) return [];
    const groups: { label: string; items: LlmImprovePreview["changes"] }[] = [];
    for (const change of improvePreview.changes) {
      const last = groups[groups.length - 1];
      if (last && last.label === change.groupLabel) {
        last.items.push(change);
      } else {
        groups.push({ label: change.groupLabel, items: [change] });
      }
    }
    return groups;
  }, [improvePreview]);

  if (!open) return null;

  return (
    <div
      className="modalOverlay"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        if (!running) onClose();
      }}
    >
      <div
        className="modal llmAssistModal"
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="modalTitle">{label.title}</div>
        <div className="modalBody">
          <div className="llmAssistModeRow" role="tablist" aria-label="LLM mode">
            <button
              type="button"
              className={"llmAssistModeButton" + (mode === "generate" ? " llmAssistModeButtonActive" : "")}
              onMouseDown={(e) => {
                e.preventDefault();
                onChangeMode("generate");
              }}
              disabled={running}
            >
              Generate
            </button>
            <button
              type="button"
              className={"llmAssistModeButton" + (mode === "improve" ? " llmAssistModeButtonActive" : "")}
              onMouseDown={(e) => {
                e.preventDefault();
                onChangeMode("improve");
              }}
              disabled={running}
            >
              Improve
            </button>
          </div>

          <label className="llmAssistField">
            <span className="llmAssistLabel">{label.promptLabel}</span>
            <textarea
              className="llmAssistTextarea"
              value={input}
              placeholder={label.placeholder}
              rows={5}
              onChange={(e) => {
                setInput(e.currentTarget.value);
                if (localError) setLocalError(null);
                if (mode === "improve" && improvePreview) {
                  onClearImprovePreview();
                }
              }}
            />
          </label>

          {mode === "improve" && improvePreview ? (
            <div className="llmPreviewBox">
              <div className="llmPreviewTitle">Preview</div>
              <div className="llmPreviewSummary">{improvePreview.summary || "(no summary)"}</div>
              <div className="llmPreviewCounts">
                <span>Add: {improvePreview.operationCounts.add}</span>
                <span>Update: {improvePreview.operationCounts.updateText}</span>
                <span>Color: {improvePreview.operationCounts.setColor}</span>
                <span>Move: {improvePreview.operationCounts.move}</span>
                <span>Delete: {improvePreview.operationCounts.delete}</span>
              </div>
              {groupedChanges.length > 0 ? (
                <div className="llmPreviewChanges">
                  {groupedChanges.map((group, groupIndex) => (
                    <div key={groupIndex} className="llmPreviewGroup">
                      <div className="llmPreviewGroupLabel">{group.label}</div>
                      {group.items.map((change, index) => (
                        <div key={index} className="llmPreviewChangeItem">
                          <div>{change.text}</div>
                          {change.nodeRef || change.parentRef ? (
                            <div className="llmPreviewChangeMeta">
                              {change.nodeRef ? `nodeRef:${change.nodeRef}` : null}
                              {change.parentRef ? ` parentRef:${change.parentRef}` : null}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ))}
                  {improvePreview.hiddenChangeCount > 0 ? (
                    <div className="llmPreviewChangeMore">
                      ...and {improvePreview.hiddenChangeCount} more changes
                    </div>
                  ) : null}
                </div>
              ) : null}
              {improvePreview.warnings.length > 0 ? (
                <div className="llmPreviewWarnings">
                  {improvePreview.warnings.map((warning, index) => (
                    <div key={index}>- {warning}</div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {localError ? <div className="llmAssistFeedback llmAssistFeedback-error">{localError}</div> : null}
          {errorMessage ? <div className="llmAssistFeedback llmAssistFeedback-error">{errorMessage}</div> : null}
          {!localError && !errorMessage ? (
            <div className="llmAssistFeedback llmAssistFeedback-muted">
              Generate は現在タブを新しいマップに置き換えます。Improve は差分提案をプレビューしてから適用します。
            </div>
          ) : null}
        </div>

        <div className="modalActions">
          {mode === "improve" && improvePreview ? (
            <button
              type="button"
              className="modalButton"
              onMouseDown={(e) => {
                e.preventDefault();
                onApplyImprovePreview();
              }}
              disabled={running}
            >
              Apply
            </button>
          ) : null}
          <button
            type="button"
            className="modalButton"
            onMouseDown={async (e) => {
              e.preventDefault();
              const trimmed = input.trim();
              if (trimmed === "") {
                setLocalError(`${label.promptLabel} を入力してください。`);
                return;
              }
              setLocalError(null);
              await onRun(trimmed);
            }}
            disabled={running}
          >
            {running
              ? "Running..."
              : mode === "improve" && improvePreview
                ? "Re-run Improve"
                : label.runLabel}
          </button>
          <button
            type="button"
            className="modalButton"
            onMouseDown={(e) => {
              e.preventDefault();
              if (!running) onClose();
            }}
            disabled={running}
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
