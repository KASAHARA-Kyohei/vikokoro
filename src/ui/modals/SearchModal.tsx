import { useEffect, useMemo, useRef } from "react";
import type { NodeId } from "../../editor/types";
import type { AppLanguage } from "../../hooks/useAppPreferences";
import "./SearchModal.scss";

export type SearchResultItem = {
  nodeId: NodeId;
  title: string;
  subtitle: string;
};

type Props = {
  open: boolean;
  language: AppLanguage;
  query: string;
  results: SearchResultItem[];
  activeIndex: number;
  activeNodeId: NodeId | null;
  onChangeQuery: (value: string) => void;
  onSelectNode: (nodeId: NodeId) => void;
  onMoveNext: () => void;
  onMovePrev: () => void;
  onClose: () => void;
};

export function SearchModal({
  open,
  language,
  query,
  results,
  activeIndex,
  activeNodeId,
  onChangeQuery,
  onSelectNode,
  onMoveNext,
  onMovePrev,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const text =
    language === "ja"
      ? {
          title: "検索",
          placeholder: "ノードを検索...",
          emptyCount: "0 件",
          resultLabel: (index: number, total: number) => `${index}/${total}`,
          listLabel: "検索結果",
          prev: "前へ (Shift+Enter)",
          next: "次へ (Enter)",
          close: "閉じる (Esc)",
        }
      : {
          title: "Search",
          placeholder: "Type to search nodes...",
          emptyCount: "0 results",
          resultLabel: (index: number, total: number) => `${index}/${total}`,
          listLabel: "Search results",
          prev: "Prev (Shift+Enter)",
          next: "Next (Enter)",
          close: "Close (Esc)",
        };

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const listStart = useMemo(() => {
    const len = results.length;
    if (len <= 8) return 0;
    return Math.max(0, Math.min(activeIndex - 3, len - 8));
  }, [activeIndex, results.length]);

  if (!open) return null;

  return (
    <div
      className="modalOverlay"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="modal searchModal"
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="modalTitle">{text.title}</div>
        <div className="modalBody">
          <div className="searchBar">
            <input
              ref={inputRef}
              className="searchInput"
              value={query}
              placeholder={text.placeholder}
              onChange={(e) => onChangeQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onClose();
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) {
                    onMovePrev();
                  } else {
                    onMoveNext();
                  }
                }
              }}
            />
            <div className="searchMeta">
              {results.length === 0
                ? text.emptyCount
                : text.resultLabel(activeIndex + 1, results.length)}
            </div>
          </div>

          {results.length > 0 ? (
            <div className="searchList" role="listbox" aria-label={text.listLabel}>
              {results.slice(listStart, listStart + 8).map((result) => {
                const isActive = result.nodeId === activeNodeId;
                return (
                  <button
                    key={result.nodeId}
                    type="button"
                    className={"searchItem" + (isActive ? " searchItemActive" : "")}
                    title={`${result.subtitle} › ${result.title}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelectNode(result.nodeId);
                    }}
                  >
                    <div className="searchItemTitle">{result.title}</div>
                    <div className="searchItemSubtitle">{result.subtitle}</div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="modalActions">
          <button
            type="button"
            className="modalButton"
            onMouseDown={(e) => {
              e.preventDefault();
              onMovePrev();
            }}
            disabled={results.length === 0}
          >
            {text.prev}
          </button>
          <button
            type="button"
            className="modalButton"
            onMouseDown={(e) => {
              e.preventDefault();
              onMoveNext();
            }}
            disabled={results.length === 0}
          >
            {text.next}
          </button>
          <button
            type="button"
            className="modalButton"
            onMouseDown={(e) => {
              e.preventDefault();
              onClose();
            }}
          >
            {text.close}
          </button>
        </div>
      </div>
    </div>
  );
}
