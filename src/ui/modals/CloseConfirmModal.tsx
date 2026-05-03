import type { AppLanguage } from "../../hooks/useAppPreferences";

type Props = {
  open: boolean;
  language: AppLanguage;
  onConfirm: () => void;
  onCancel: () => void;
};

export function CloseConfirmModal({ open, language, onConfirm, onCancel }: Props) {
  if (!open) return null;

  const text =
    language === "ja"
      ? {
          title: "タブを閉じますか？",
          body: "y: 閉じる / n: キャンセル",
          confirm: "閉じる (y)",
          cancel: "キャンセル (n)",
        }
      : {
          title: "Close this tab?",
          body: "y: close / n: cancel",
          confirm: "Close (y)",
          cancel: "Cancel (n)",
        };

  return (
    <div className="modalOverlay" onMouseDown={(e) => e.preventDefault()}>
      <div className="modal">
        <div className="modalTitle">{text.title}</div>
        <div className="modalBody">{text.body}</div>
        <div className="modalActions">
          <button
            type="button"
            className="modalButton modalButtonDanger"
            onMouseDown={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {text.confirm}
          </button>
          <button
            type="button"
            className="modalButton"
            onMouseDown={(e) => {
              e.preventDefault();
              onCancel();
            }}
          >
            {text.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
