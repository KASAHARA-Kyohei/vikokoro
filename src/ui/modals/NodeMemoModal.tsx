import { useEffect, useRef } from "react";
import type { AppLanguage } from "../../hooks/useAppPreferences";
import { Dialog } from "../Dialog";
import "./NodeMemoModal.scss";

type Props = {
  open: boolean;
  language: AppLanguage;
  nodeTitle: string;
  note: string;
  onChangeNote: (note: string) => void;
  onClose: () => void;
};

export function NodeMemoModal({
  open,
  language,
  nodeTitle,
  note,
  onChangeNote,
  onClose,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const length = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(length, length);
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const text =
    language === "ja"
      ? {
          title: "詳細メモ",
          subject: "対象ノード",
          hint: "複数行のメモを残せます。Esc で閉じると内容を確定します。",
          placeholder: "このノードの詳細、補足、次のアクションなどを書けます。",
          close: "閉じる (Esc)",
        }
      : {
          title: "Node memo",
          subject: "Selected node",
          hint: "Write multi-line notes here. Closing with Esc commits the current content.",
          placeholder: "Add details, context, or next actions for this node.",
          close: "Close (Esc)",
        };

  return (
    <Dialog open={open} title={text.title} className="nodeMemoModal" initialFocusRef={textareaRef} onClose={onClose}>
        <div className="modalBody">
          <div className="nodeMemoSubjectLabel">{text.subject}</div>
          <div className="nodeMemoSubjectValue" title={nodeTitle}>
            {nodeTitle}
          </div>
          <div className="nodeMemoHint">{text.hint}</div>
          <textarea
            ref={textareaRef}
            className="nodeMemoTextarea"
            value={note}
            placeholder={text.placeholder}
            rows={10}
            onChange={(e) => onChangeNote(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
          />
        </div>

        <div className="modalActions">
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
