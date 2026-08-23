import type { AppLanguage } from "../../hooks/useAppPreferences";
import { Dialog } from "../Dialog";

type Props = {
  open: boolean;
  language: AppLanguage;
  onConfirm: () => void;
  onCancel: () => void;
};

export function CloseConfirmModal({ open, language, onConfirm, onCancel }: Props) {
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
    <Dialog open={open} title={text.title} closeOnBackdrop={false} onClose={onCancel}>
        <div className="modalBody">{text.body}</div>
        <div className="modalActions">
          <button
            type="button"
            className="modalButton modalButtonDanger"
            onClick={onConfirm}
          >
            {text.confirm}
          </button>
          <button
            type="button"
            className="modalButton"
            onClick={onCancel}
          >
            {text.cancel}
          </button>
        </div>
    </Dialog>
  );
}
