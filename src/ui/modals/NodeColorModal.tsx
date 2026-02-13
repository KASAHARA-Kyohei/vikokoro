import type { NodeColor } from "../../editor/types";
import "./NodeColorModal.scss";

type ColorOption = {
  color: NodeColor;
  shortcut: string;
  label: string;
  hint?: string;
};

const COLOR_OPTIONS: ColorOption[] = [
  { color: "blue", shortcut: "1", label: "Blue" },
  { color: "green", shortcut: "2", label: "Green" },
  { color: "yellow", shortcut: "3", label: "Yellow" },
  { color: "pink", shortcut: "4", label: "Pink" },
  { color: "gray", shortcut: "5", label: "Gray", hint: "done" },
];

type Props = {
  open: boolean;
  activeColor: NodeColor | null;
  onApplyColor: (color: NodeColor) => void;
  onClear: () => void;
  onClose: () => void;
};

export function NodeColorModal({ open, activeColor, onApplyColor, onClear, onClose }: Props) {
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
        className="modal nodeColorModal"
        onMouseDown={(e) => {
          e.preventDefault();
        }}
      >
        <div className="modalTitle">Node color</div>
        <div className="modalBody">
          <div className="nodeColorHint">Press 1-5 to apply, 0 to clear, Esc to close.</div>
          <div className="nodeColorList">
            {COLOR_OPTIONS.map((option) => {
              const isActive = option.color === activeColor;
              return (
                <button
                  key={option.color}
                  type="button"
                  className={"nodeColorItem" + (isActive ? " nodeColorItemActive" : "")}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onApplyColor(option.color);
                  }}
                >
                  <div className="nodeColorItemMain">
                    <span className={"nodeColorSwatch nodeColorSwatch-" + option.color} />
                    <span className="nodeColorName">{option.label}</span>
                    {option.hint ? <span className="nodeColorHintPill">{option.hint}</span> : null}
                  </div>
                  <span className="nodeColorKey">{option.shortcut}</span>
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
              onClear();
            }}
          >
            Clear (0)
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
