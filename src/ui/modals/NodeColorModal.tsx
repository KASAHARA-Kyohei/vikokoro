import type { NodeColor } from "../../editor/types";
import type { AppLanguage } from "../../hooks/useAppPreferences";
import { Dialog } from "../Dialog";
import "./NodeColorModal.scss";

type ColorOption = {
  color: NodeColor;
  shortcut: string;
  label: string;
  hint?: string;
};

function buildColorOptions(language: AppLanguage): ColorOption[] {
  if (language === "ja") {
    return [
      { color: "blue", shortcut: "1", label: "青" },
      { color: "green", shortcut: "2", label: "緑" },
      { color: "yellow", shortcut: "3", label: "黄" },
      { color: "pink", shortcut: "4", label: "桃" },
      { color: "gray", shortcut: "5", label: "灰", hint: "完了" },
    ];
  }

  return [
    { color: "blue", shortcut: "1", label: "Blue" },
    { color: "green", shortcut: "2", label: "Green" },
    { color: "yellow", shortcut: "3", label: "Yellow" },
    { color: "pink", shortcut: "4", label: "Pink" },
    { color: "gray", shortcut: "5", label: "Gray", hint: "done" },
  ];
}

type Props = {
  open: boolean;
  language: AppLanguage;
  activeColor: NodeColor | null;
  onApplyColor: (color: NodeColor) => void;
  onClear: () => void;
  onClose: () => void;
};

export function NodeColorModal({
  open,
  language,
  activeColor,
  onApplyColor,
  onClear,
  onClose,
}: Props) {
  const text =
    language === "ja"
      ? {
          title: "ノード色",
          hint: "1-5 で適用、0 で解除、Esc で閉じます。",
          clear: "解除 (0)",
          close: "閉じる (Esc)",
        }
      : {
          title: "Node color",
          hint: "Press 1-5 to apply, 0 to clear, Esc to close.",
          clear: "Clear (0)",
          close: "Close (Esc)",
        };
  const colorOptions = buildColorOptions(language);

  return (
    <Dialog open={open} title={text.title} className="nodeColorModal" onClose={onClose}>
        <div className="modalBody">
          <div className="nodeColorHint">{text.hint}</div>
          <div className="nodeColorList">
            {colorOptions.map((option) => {
              const isActive = option.color === activeColor;
              return (
                <button
                  key={option.color}
                  type="button"
                  className={"nodeColorItem" + (isActive ? " nodeColorItemActive" : "")}
                  onClick={() => onApplyColor(option.color)}
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
            onClick={onClear}
          >
            {text.clear}
          </button>
          <button
            type="button"
            className="modalButton"
            onClick={onClose}
          >
            {text.close}
          </button>
        </div>
    </Dialog>
  );
}
