import { useEffect, useRef } from "react";
import type { AppLanguage } from "../../hooks/useAppPreferences";
import "./CommandPaletteModal.scss";

export type PaletteItem = {
  id: string;
  title: string;
  subtitle?: string;
};

type Props = {
  open: boolean;
  language: AppLanguage;
  query: string;
  activeIndex: number;
  items: PaletteItem[];
  onChangeQuery: (value: string) => void;
  onMoveIndex: (nextIndex: number) => void;
  onRunActive: () => void;
  onRunItem: (id: string) => void;
  onClose: () => void;
};

export function CommandPaletteModal({
  open,
  language,
  query,
  activeIndex,
  items,
  onChangeQuery,
  onMoveIndex,
  onRunActive,
  onRunItem,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const text =
    language === "ja"
      ? {
          title: "コマンドパレット",
          placeholder: "コマンドを入力...",
          count: `${items.length} 件`,
          listLabel: "コマンド一覧",
          run: "実行 (Enter)",
          close: "閉じる (Esc)",
        }
      : {
          title: "Command palette",
          placeholder: "Type a command...",
          count: `${items.length} commands`,
          listLabel: "Commands",
          run: "Run (Enter)",
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
        className="modal paletteModal"
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="modalTitle">{text.title}</div>
        <div className="modalBody">
          <div className="paletteBar">
            <input
              ref={inputRef}
              className="paletteInput"
              value={query}
              placeholder={text.placeholder}
              onChange={(e) => onChangeQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onClose();
                  return;
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  onMoveIndex(Math.min(activeIndex + 1, Math.max(0, items.length - 1)));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  onMoveIndex(Math.max(activeIndex - 1, 0));
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  onRunActive();
                }
              }}
            />
            <div className="paletteMeta">{text.count}</div>
          </div>

          <div className="paletteList" role="listbox" aria-label={text.listLabel}>
            {items.map((item, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={"paletteItem" + (isActive ? " paletteItemActive" : "")}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onMoveIndex(idx);
                    onRunItem(item.id);
                  }}
                >
                  <div className="paletteItemTitle">{item.title}</div>
                  {item.subtitle ? <div className="paletteItemSubtitle">{item.subtitle}</div> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="modalActions">
          <button
            type="button"
            className="modalButton"
            onMouseDown={(e) => {
              e.preventDefault();
              onRunActive();
            }}
            disabled={items.length === 0}
          >
            {text.run}
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
