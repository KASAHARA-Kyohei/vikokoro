type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function CloseConfirmModal({ open, onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <div className="modalOverlay" onMouseDown={(e) => e.preventDefault()}>
      <div className="modal">
        <div className="modalTitle">タブを閉じますか？</div>
        <div className="modalBody">y: 閉じる / n: キャンセル</div>
        <div className="modalActions">
          <button
            type="button"
            className="modalButton modalButtonDanger"
            onMouseDown={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            閉じる (y)
          </button>
          <button
            type="button"
            className="modalButton"
            onMouseDown={(e) => {
              e.preventDefault();
              onCancel();
            }}
          >
            キャンセル (n)
          </button>
        </div>
      </div>
    </div>
  );
}

