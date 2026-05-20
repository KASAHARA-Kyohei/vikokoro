import type { AppLanguage } from "../../hooks/useAppPreferences";
import "./HelpModal.scss";

type Props = {
  open: boolean;
  language: AppLanguage;
  onClose: () => void;
};

type HelpRow = {
  keys: string;
  description: string;
};

function buildRows(language: AppLanguage): HelpRow[] {
  if (language === "ja") {
    return [
      { keys: "Tab", description: "子ノードを追加して編集開始" },
      { keys: "Enter", description: "兄弟ノードを追加して編集開始" },
      { keys: "i / Enter / Esc", description: "入力 / 確定 / 通常モードへ戻る" },
      { keys: "h j k l", description: "移動（親 / 次 / 前 / 子）" },
      { keys: "J / K", description: "兄弟ノードを下 / 上へ入れ替え" },
      { keys: "H / L", description: "ノードを左 / 右へ移動（アウトデント / インデント）" },
      { keys: "f + ヒント", description: "任意ノードへジャンプ" },
      { keys: "dd", description: "削除（ルートは保護）" },
      { keys: "c", description: "ノード色メニューを開く" },
      { keys: "m", description: "詳細メモを開く" },
      { keys: "u / Ctrl+r", description: "Undo / Redo" },
      { keys: "Ctrl+t / Ctrl+w", description: "新規タブ / タブを閉じる" },
      { keys: "Ctrl+Tab / Ctrl+Shift+Tab", description: "次 / 前のタブへ切替" },
      { keys: "Ctrl+f", description: "検索" },
      { keys: "Ctrl+p", description: "コマンドパレット" },
      { keys: "AI支援", description: "AI支援モーダルを開く（生成 / 改善 / レビュー）" },
      { keys: "設定", description: "言語 / テーマ / AI設定を開く" },
      { keys: "Ctrl + Wheel", description: "ズーム" },
      { keys: "Space + Drag", description: "パン" },
      { keys: "?", description: "ヘルプを開く" },
    ];
  }

  return [
    { keys: "Tab", description: "Add a child node and start editing" },
    { keys: "Enter", description: "Add a sibling node and start editing" },
    { keys: "i / Enter / Esc", description: "Insert / Commit / Return to normal mode" },
    { keys: "h j k l", description: "Move (parent / next / previous / child)" },
    { keys: "J / K", description: "Swap sibling nodes down / up" },
    { keys: "H / L", description: "Move node left / right (outdent / indent)" },
    { keys: "f + hint", description: "Jump to any node" },
    { keys: "dd", description: "Delete (root is protected)" },
    { keys: "c", description: "Open the node color menu" },
    { keys: "m", description: "Open the node memo" },
    { keys: "u / Ctrl+r", description: "Undo / Redo" },
    { keys: "Ctrl+t / Ctrl+w", description: "New tab / Close tab" },
    { keys: "Ctrl+Tab / Ctrl+Shift+Tab", description: "Switch to next / previous tab" },
    { keys: "Ctrl+f", description: "Search" },
    { keys: "Ctrl+p", description: "Command palette" },
    { keys: "AI Assist", description: "Open AI Assist (Generate / Improve / Review)" },
    { keys: "Settings", description: "Open language, theme, and AI settings" },
    { keys: "Ctrl + Wheel", description: "Zoom" },
    { keys: "Space + Drag", description: "Pan" },
    { keys: "?", description: "Open help" },
  ];
}

export function HelpModal({ open, language, onClose }: Props) {
  if (!open) return null;

  const text =
    language === "ja"
      ? {
          title: "ヘルプ",
          close: "閉じる (Esc)",
        }
      : {
          title: "Help",
          close: "Close (Esc)",
        };

  const rows = buildRows(language);

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
        className="modal helpModal"
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="modalTitle">{text.title}</div>
        <div className="modalBody">
          <div className="helpGrid">
            {rows.map((row) => (
              <div key={`${row.keys}-${row.description}`} className="helpRow">
                <div className="helpKeys">{row.keys}</div>
                <div className="helpDesc">{row.description}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="modalActions">
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
