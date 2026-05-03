import { useEffect, useMemo, useState } from "react";
import type { LlmImprovePreview, LlmReviewResult } from "../../features/llm/preview";
import type { AppLanguage } from "../../hooks/useAppPreferences";
import "./LlmAssistModal.scss";

export type LlmAssistMode = "generate" | "improve" | "review";

type Props = {
  open: boolean;
  mode: LlmAssistMode;
  language: AppLanguage;
  running: boolean;
  errorMessage: string | null;
  improvePreview: LlmImprovePreview | null;
  reviewResult: LlmReviewResult | null;
  onChangeMode: (mode: LlmAssistMode) => void;
  onRun: (input: string) => Promise<void>;
  onApplyImprovePreview: () => void;
  onClearImprovePreview: () => void;
  onClearReviewResult: () => void;
  onClose: () => void;
};

function defaultInputFor(mode: LlmAssistMode, language: AppLanguage): string {
  if (language === "ja") {
    if (mode === "generate") return "生成AIを使った業務改善";
    if (mode === "improve") return "漏れを補完し、実行可能な粒度にする";
    return "漏れ・曖昧さ・次のアクションをレビューしてください";
  }
  if (mode === "generate") return "Operational improvement ideas using generative AI";
  if (mode === "improve") return "Fill gaps and make the map actionable";
  return "Review the map for gaps, ambiguity, and next actions";
}

function getText(mode: LlmAssistMode, language: AppLanguage) {
  const shared =
    language === "ja"
      ? {
          title: "AI支援",
          tabs: {
            generate: "生成",
            improve: "改善",
            review: "レビュー",
          },
          runningText: "AI に現在の内容を送信して結果を待っています。",
          previewTitle: "プレビュー",
          reviewTitle: "レビュー結果",
          noSummary: "(要約なし)",
          changeCounts: {
            add: "追加",
            update: "更新",
            color: "色",
            move: "移動",
            delete: "削除",
          },
          hiddenMore: (count: number) => `...ほか ${count} 件`,
          strengths: "良い点",
          findings: "指摘",
          noFindings: "指摘はありませんでした。",
          nextActions: "次のアクション",
          suggestion: "提案",
          scopeAll: "対象: マップ全体",
          apply: "適用",
          close: "閉じる (Esc)",
          inputRequired: (promptLabel: string) => `${promptLabel} を入力してください。`,
        }
      : {
          title: "AI Assist",
          tabs: {
            generate: "Generate",
            improve: "Improve",
            review: "Review",
          },
          runningText: "Sending the current content to the AI and waiting for a response.",
          previewTitle: "Preview",
          reviewTitle: "Review",
          noSummary: "(no summary)",
          changeCounts: {
            add: "Add",
            update: "Update",
            color: "Color",
            move: "Move",
            delete: "Delete",
          },
          hiddenMore: (count: number) => `...and ${count} more`,
          strengths: "Strengths",
          findings: "Findings",
          noFindings: "No findings were reported.",
          nextActions: "Next actions",
          suggestion: "Suggestion",
          scopeAll: "Scope: Entire map",
          apply: "Apply",
          close: "Close (Esc)",
          inputRequired: (promptLabel: string) => `Please enter ${promptLabel.toLowerCase()}.`,
        };

  if (mode === "generate") {
    return {
      ...shared,
      promptLabel: language === "ja" ? "トピック" : "Topic",
      placeholder:
        language === "ja"
          ? "例: 新規事業アイデアの整理"
          : "Example: Organize ideas for a new business",
      runLabel: shared.tabs.generate,
      rerunLabel: language === "ja" ? "再生成" : "Re-run Generate",
      runningLabel: language === "ja" ? "生成中..." : "Generating...",
      description:
        language === "ja"
          ? "現在タブを新しいマップに置き換えます。"
          : "Replaces the current tab with a new map.",
    };
  }

  if (mode === "improve") {
    return {
      ...shared,
      promptLabel: language === "ja" ? "改善方針" : "Goal",
      placeholder:
        language === "ja"
          ? "例: 漏れを補完し、実行ステップを追加"
          : "Example: Fill gaps and add execution steps",
      runLabel: shared.tabs.improve,
      rerunLabel: language === "ja" ? "再改善" : "Re-run Improve",
      runningLabel: language === "ja" ? "改善中..." : "Improving...",
      description:
        language === "ja"
          ? "差分提案をプレビューしてから適用します。"
          : "Shows a diff preview before applying changes.",
    };
  }

  return {
    ...shared,
    promptLabel: language === "ja" ? "レビュー観点" : "Review focus",
    placeholder:
      language === "ja"
        ? "例: 曖昧さ、漏れ、次のアクションを確認"
        : "Example: Check ambiguity, gaps, and next actions",
    runLabel: shared.tabs.review,
    rerunLabel: language === "ja" ? "再レビュー" : "Re-run Review",
    runningLabel: language === "ja" ? "レビュー中..." : "Reviewing...",
    description:
      language === "ja"
        ? "現在タブ全体をレビューし、構造の問題や次のアクションを返します。"
        : "Reviews the entire current tab and returns structural issues and next actions.",
  };
}

export function LlmAssistModal({
  open,
  mode,
  language,
  running,
  errorMessage,
  improvePreview,
  reviewResult,
  onChangeMode,
  onRun,
  onApplyImprovePreview,
  onClearImprovePreview,
  onClearReviewResult,
  onClose,
}: Props) {
  const [input, setInput] = useState(defaultInputFor(mode, language));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setInput(defaultInputFor(mode, language));
    setLocalError(null);
  }, [language, mode, open]);

  const label = useMemo(() => getText(mode, language), [language, mode]);

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

  const severityLabel = useMemo(() => {
    return language === "ja"
      ? ({
          high: "高",
          medium: "中",
          low: "低",
        } as const)
      : ({
          high: "High",
          medium: "Medium",
          low: "Low",
        } as const);
  }, [language]);

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
          <div
            className="llmAssistModeRow"
            role="tablist"
            aria-label={language === "ja" ? "AIモード" : "AI mode"}
          >
            <button
              type="button"
              className={"llmAssistModeButton" + (mode === "generate" ? " llmAssistModeButtonActive" : "")}
              onMouseDown={(e) => {
                e.preventDefault();
                onChangeMode("generate");
              }}
              disabled={running}
            >
              {label.tabs.generate}
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
              {label.tabs.improve}
            </button>
            <button
              type="button"
              className={"llmAssistModeButton" + (mode === "review" ? " llmAssistModeButtonActive" : "")}
              onMouseDown={(e) => {
                e.preventDefault();
                onChangeMode("review");
              }}
              disabled={running}
            >
              {label.tabs.review}
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
                if (mode === "review" && reviewResult) {
                  onClearReviewResult();
                }
              }}
              disabled={running}
            />
          </label>

          {running ? (
            <div className="llmAssistRunningBox" role="status" aria-live="polite">
              <div className="llmAssistSpinner" aria-hidden="true" />
              <div>
                <div className="llmAssistRunningTitle">{label.runningLabel}</div>
                <div className="llmAssistRunningText">{label.runningText}</div>
              </div>
            </div>
          ) : null}

          {mode === "improve" && improvePreview ? (
            <div className="llmPreviewBox">
              <div className="llmPreviewTitle">{label.previewTitle}</div>
              <div className="llmPreviewSummary">{improvePreview.summary || label.noSummary}</div>
              <div className="llmPreviewCounts">
                <span>
                  {label.changeCounts.add}: {improvePreview.operationCounts.add}
                </span>
                <span>
                  {label.changeCounts.update}: {improvePreview.operationCounts.updateText}
                </span>
                <span>
                  {label.changeCounts.color}: {improvePreview.operationCounts.setColor}
                </span>
                <span>
                  {label.changeCounts.move}: {improvePreview.operationCounts.move}
                </span>
                <span>
                  {label.changeCounts.delete}: {improvePreview.operationCounts.delete}
                </span>
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
                      {label.hiddenMore(improvePreview.hiddenChangeCount)}
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

          {mode === "review" && reviewResult ? (
            <div className="llmReviewBox">
              <div className="llmPreviewTitle">{label.reviewTitle}</div>
              <div className="llmReviewSummary">{reviewResult.summary}</div>

              {reviewResult.strengths.length > 0 ? (
                <div className="llmReviewSection">
                  <div className="llmReviewSectionTitle">{label.strengths}</div>
                  <div className="llmReviewList">
                    {reviewResult.strengths.map((strength, index) => (
                      <div key={index} className="llmReviewListItem">
                        - {strength}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="llmReviewSection">
                <div className="llmReviewSectionTitle">{label.findings}</div>
                {reviewResult.findings.length === 0 ? (
                  <div className="llmReviewEmpty">{label.noFindings}</div>
                ) : (
                  <div className="llmReviewFindings">
                    {reviewResult.findings.map((finding, index) => (
                      <div key={index} className="llmReviewFinding">
                        <div className="llmReviewFindingHead">
                          <span className={"llmReviewSeverity llmReviewSeverity-" + finding.severity}>
                            {severityLabel[finding.severity]}
                          </span>
                          <span className="llmReviewFindingTitle">{finding.title}</span>
                        </div>
                        <div className="llmReviewFindingDetail">{finding.detail}</div>
                        <div className="llmReviewFindingSuggestion">
                          {label.suggestion}: {finding.suggestion}
                        </div>
                        {finding.refs.length > 0 ? (
                          <div className="llmReviewRefs">
                            {finding.refs.map((ref) => (
                              <div key={ref.nodeId} className="llmReviewRef">
                                <div className="llmReviewRefTitle">{ref.title}</div>
                                <div className="llmReviewRefPath">{ref.path}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="llmReviewRefPath">{label.scopeAll}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {reviewResult.nextActions.length > 0 ? (
                <div className="llmReviewSection">
                  <div className="llmReviewSectionTitle">{label.nextActions}</div>
                  <div className="llmReviewList">
                    {reviewResult.nextActions.map((action, index) => (
                      <div key={index} className="llmReviewListItem">
                        {index + 1}. {action}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {localError ? <div className="llmAssistFeedback llmAssistFeedback-error">{localError}</div> : null}
          {errorMessage ? <div className="llmAssistFeedback llmAssistFeedback-error">{errorMessage}</div> : null}
          {!localError && !errorMessage ? (
            <div className="llmAssistFeedback llmAssistFeedback-muted">{label.description}</div>
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
              {label.apply}
            </button>
          ) : null}
          <button
            type="button"
            className="modalButton"
            onMouseDown={async (e) => {
              e.preventDefault();
              const trimmed = input.trim();
              if (trimmed === "") {
                setLocalError(label.inputRequired(label.promptLabel));
                return;
              }
              setLocalError(null);
              await onRun(trimmed);
            }}
            disabled={running}
          >
            {running
              ? label.runningLabel
              : (mode === "improve" && improvePreview) || (mode === "review" && reviewResult)
                ? label.rerunLabel
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
            {label.close}
          </button>
        </div>
      </div>
    </div>
  );
}
