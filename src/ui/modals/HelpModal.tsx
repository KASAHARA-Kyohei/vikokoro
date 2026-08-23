import { useMemo, useRef, useState } from "react";
import type { AppLanguage } from "../../hooks/useAppPreferences";
import { Dialog } from "../Dialog";
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

type HelpCategory = "start" | "mouse" | "vim" | "organize" | "view";

function categoryForRow(row: HelpRow, index: number): HelpCategory {
  if (index < 5) return "start";
  if (/Drag|Click|Double|線|付箋|Sticky|Edge|Wheel/.test(row.keys)) return "mouse";
  if (/= \/ \+/.test(row.keys)) return "organize";
  if (/^(f|F|zz|za|zM|Ctrl \+ Wheel|Space \+ Drag)/.test(row.keys)) return "view";
  return "vim";
}

function buildRows(language: AppLanguage): HelpRow[] {
  if (language === "ja") {
    return [
      { keys: "a → q w e / a d / z x c", description: "8方向を選んで子ノードを追加（Escで中止）" },
      { keys: "Tab", description: "子ノードを追加して編集開始" },
      { keys: "Enter", description: "同じ枝方向へ兄弟ノードを追加して編集開始" },
      { keys: "i / Enter / Esc", description: "入力 / 確定 / 通常モードへ戻る" },
      { keys: "Shift+Enter", description: "ノード本文内で改行" },
      { keys: "h j k l", description: "画面上の左 / 下 / 上 / 右へ移動" },
      { keys: "← ↓ ↑ →", description: "階層移動（親 / 次 / 前 / 子）" },
      { keys: "J / K", description: "兄弟ノードを下 / 上へ入れ替え" },
      { keys: "H / L", description: "ノードを左 / 右へ移動（アウトデント / インデント）" },
      { keys: "Drag / Shift+Drag", description: "ノード単体 / 枝全体を自由配置" },
      { keys: "Shift+Click / 空白Drag", description: "複数選択 / 矩形選択" },
      { keys: "空白Double Click", description: "その位置に子ノードを追加" },
      { keys: "Alt+h j k l", description: "選択ノードを8px移動（Shift併用で32px）" },
      { keys: "= / +", description: "選択枝 / マップ全体を自動整列" },
      { keys: "線Click → 接続点", description: "親子線の出入り位置を手動指定（Autoで解除）" },
      { keys: "f + ヒント", description: "任意ノードへジャンプ" },
      { keys: "F / Esc", description: "選択した枝へフォーカス / 全体表示へ戻る" },
      { keys: "zz", description: "選択中のノードを画面中央へ移動" },
      { keys: "za / zc / zo", description: "枝の開閉切替 / 折りたたむ / 展開する" },
      { keys: "zM / zR", description: "表示中の枝をすべて折りたたむ / 展開する" },
      { keys: "dd", description: "削除（ルートは保護）" },
      { keys: "c", description: "ノード色メニューを開く" },
      { keys: "m", description: "詳細メモを開く" },
      { keys: "u / Ctrl+r", description: "Undo / Redo" },
      { keys: "Ctrl+t / Ctrl+w", description: "新規タブ / タブを閉じる" },
      { keys: "Ctrl+Tab / Ctrl+Shift+Tab", description: "次 / 前のタブへ切替" },
      { keys: "Ctrl+f", description: "検索" },
      { keys: "Ctrl+p", description: "コマンドパレット" },
      { keys: "r + ヒント", description: "選択ノードからヒント先へ補助線を追加" },
      { keys: "補助線選択 → Delete / dd", description: "選択した補助線を削除" },
      { keys: "付箋追加", description: "パレットで付箋モードに入り、空白Double Clickで配置" },
      { keys: "付箋Double Click", description: "付箋を編集（Esc / Blurで確定）" },
      { keys: "付箋選択 → Delete / dd", description: "選択した付箋を削除" },
      { keys: "⌘Enter / ⌘D", description: "カード作成 / 複製" },
      { keys: "設定", description: "言語 / テーマを開く" },
      { keys: "Ctrl + Wheel", description: "ズーム" },
      { keys: "Space + Drag", description: "パン" },
      { keys: "?", description: "ヘルプを開く" },
    ];
  }

  return [
    { keys: "a → q w e / a d / z x c", description: "Choose one of 8 directions for a child (Esc cancels)" },
    { keys: "Tab", description: "Add a child node and start editing" },
    { keys: "Enter", description: "Add a sibling in the current branch direction" },
    { keys: "i / Enter / Esc", description: "Insert / Commit / Return to normal mode" },
    { keys: "Shift+Enter", description: "Insert a line break in node text" },
    { keys: "h j k l", description: "Move visually left / down / up / right" },
    { keys: "← ↓ ↑ →", description: "Hierarchy (parent / next / previous / child)" },
    { keys: "J / K", description: "Swap sibling nodes down / up" },
    { keys: "H / L", description: "Move node left / right (outdent / indent)" },
    { keys: "Drag / Shift+Drag", description: "Freely move a node / entire branch" },
    { keys: "Shift+Click / blank Drag", description: "Multi-select / marquee select" },
    { keys: "Blank Double Click", description: "Add a child at that position" },
    { keys: "Alt+h j k l", description: "Nudge selection 8px (32px with Shift)" },
    { keys: "= / +", description: "Auto-layout selected branch / entire map" },
    { keys: "Edge click → anchor", description: "Manually choose connector sides (Auto resets)" },
    { keys: "f + hint", description: "Jump to any node" },
    { keys: "F / Esc", description: "Focus selected branch / Return to full map" },
    { keys: "zz", description: "Center the selected node" },
    { keys: "za / zc / zo", description: "Toggle / Collapse / Expand branch" },
    { keys: "zM / zR", description: "Collapse / Expand all visible branches" },
    { keys: "dd", description: "Delete (root is protected)" },
    { keys: "c", description: "Open the node color menu" },
    { keys: "m", description: "Open the node memo" },
    { keys: "u / Ctrl+r", description: "Undo / Redo" },
    { keys: "Ctrl+t / Ctrl+w", description: "New tab / Close tab" },
    { keys: "Ctrl+Tab / Ctrl+Shift+Tab", description: "Switch to next / previous tab" },
    { keys: "Ctrl+f", description: "Search" },
    { keys: "Ctrl+p", description: "Command palette" },
    { keys: "r + hint", description: "Add a related link from selected node to hinted node" },
    { keys: "Related link → Delete / dd", description: "Delete the selected related link" },
    { keys: "Add sticky note", description: "Enter sticky mode from the palette, then blank double-click" },
    { keys: "Sticky Double Click", description: "Edit sticky note text (Esc / blur commits)" },
    { keys: "Sticky → Delete / dd", description: "Delete the selected sticky note" },
    { keys: "Cmd+Enter / Cmd+D", description: "Create / duplicate cards" },
    { keys: "Settings", description: "Open language and theme settings" },
    { keys: "Ctrl + Wheel", description: "Zoom" },
    { keys: "Space + Drag", description: "Pan" },
    { keys: "?", description: "Open help" },
  ];
}

export function HelpModal({ open, language, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HelpCategory>("start");
  const searchRef = useRef<HTMLInputElement | null>(null);

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

  const rows = useMemo(() => buildRows(language), [language]);
  const categories: Array<{ id: HelpCategory; label: string }> = language === "ja"
    ? [
        { id: "start", label: "最初の5操作" },
        { id: "mouse", label: "マウス" },
        { id: "vim", label: "Vim" },
        { id: "organize", label: "整理" },
        { id: "view", label: "表示" },
      ]
    : [
        { id: "start", label: "First 5" },
        { id: "mouse", label: "Mouse" },
        { id: "vim", label: "Vim" },
        { id: "organize", label: "Organize" },
        { id: "view", label: "View" },
      ];
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return rows.filter((row, index) => {
      if (!normalized && categoryForRow(row, index) !== category) return false;
      return !normalized || `${row.keys} ${row.description}`.toLocaleLowerCase().includes(normalized);
    });
  }, [category, query, rows]);

  return (
    <Dialog open={open} title={text.title} className="helpModal" initialFocusRef={searchRef} isolateKeyboard onClose={onClose}>
        <div className="modalBody">
          <input
            ref={searchRef}
            className="helpSearch"
            value={query}
            placeholder={language === "ja" ? "操作を検索..." : "Search actions..."}
            aria-label={language === "ja" ? "ヘルプを検索" : "Search help"}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <div className="helpCategories" role="tablist">
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={category === item.id}
                className={category === item.id ? "helpCategoryActive" : ""}
                onClick={() => {
                  setQuery("");
                  setCategory(item.id);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="helpGrid">
            {filteredRows.map((row) => (
              <div key={`${row.keys}-${row.description}`} className="helpRow">
                <div className="helpKeys">{row.keys}</div>
                <div className="helpDesc">{row.description}</div>
              </div>
            ))}
            {filteredRows.length === 0 ? (
              <div className="helpEmpty">{language === "ja" ? "一致する操作がありません" : "No matching actions"}</div>
            ) : null}
          </div>
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
