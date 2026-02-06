import { useEffect, useRef } from "react";

export type PaletteItem = {
  id: string;
  title: string;
  subtitle?: string;
};

type Props = {
  open: boolean;
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
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="modal paletteModal"
        onMouseDown={(e) => {
          e.preventDefault();
        }}
      >
        <div className="modalTitle">Command palette</div>
        <div className="modalBody">
          <div className="paletteBar">
            <input
              ref={inputRef}
              className="paletteInput"
              value={query}
              placeholder="Type a command…"
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
            <div className="paletteMeta">{items.length} commands</div>
          </div>

          <div className="paletteList" role="listbox" aria-label="Commands">
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
            Run (Enter)
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

