import { useEffect, useMemo, useRef } from "react";
import type { NodeId } from "../../editor/types";

export type SearchResultItem = {
  nodeId: NodeId;
  title: string;
  subtitle: string;
};

type Props = {
  open: boolean;
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
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="modal searchModal"
        onMouseDown={(e) => {
          e.preventDefault();
        }}
      >
        <div className="modalTitle">Search</div>
        <div className="modalBody">
          <div className="searchBar">
            <input
              ref={inputRef}
              className="searchInput"
              value={query}
              placeholder="Type to search nodes…"
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
              {results.length === 0 ? "0 results" : `${activeIndex + 1}/${results.length}`}
            </div>
          </div>

          {results.length > 0 ? (
            <div className="searchList" role="listbox" aria-label="Search results">
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
            Prev (Shift+Enter)
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
            Next (Enter)
          </button>
          <button
            type="button"
            className="modalButton"
            onMouseDown={(e) => {
              e.preventDefault();
              onClose();
            }}
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}

