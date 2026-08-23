import type { AppLanguage } from "../hooks/useAppPreferences";
import "./SelectionToolbar.scss";

type Props = {
  language: AppLanguage;
  position: { left: number; top: number };
  multiCount: number;
  isRoot: boolean;
  menuOpen: boolean;
  kind?: "nodes" | "sticky" | "link" | "edge";
  onAddChild: () => void;
  onAddSibling: () => void;
  onEdit: () => void;
  onToggleMenu: () => void;
  onMemo: () => void;
  onColor: () => void;
  onDuplicate: () => void;
  onToggleCollapse: () => void;
  onFocus: () => void;
  onDelete: () => void;
  onEditAuxiliary?: () => void;
  onAutoAnchor?: () => void;
};

export function SelectionToolbar({
  language,
  position,
  multiCount,
  isRoot,
  menuOpen,
  kind = "nodes",
  onAddChild,
  onAddSibling,
  onEdit,
  onToggleMenu,
  onMemo,
  onColor,
  onDuplicate,
  onToggleCollapse,
  onFocus,
  onDelete,
  onEditAuxiliary,
  onAutoAnchor,
}: Props) {
  const ja = language === "ja";
  return (
    <div className="selectionToolbar" style={position} role="toolbar" aria-label={ja ? "選択ノードの操作" : "Selected node actions"}>
      {kind !== "nodes" ? (
        <>
          <span className="selectionToolbarCount">
            {kind === "sticky" ? (ja ? "付箋" : "Sticky") : kind === "edge" ? (ja ? "接続線" : "Connector") : (ja ? "補助線" : "Related link")}
          </span>
          {onEditAuxiliary ? <button type="button" title={ja ? "編集" : "Edit"} aria-label={ja ? "編集" : "Edit"} onClick={onEditAuxiliary}>✎</button> : null}
          {onAutoAnchor ? <button type="button" title={ja ? "アンカーを自動化" : "Reset anchors to auto"} aria-label={ja ? "アンカーを自動化" : "Reset anchors to auto"} onClick={onAutoAnchor}>Auto</button> : null}
          {kind !== "edge" ? <button type="button" title={ja ? "削除" : "Delete"} aria-label={ja ? "削除" : "Delete"} onClick={onDelete}>⌫</button> : null}
        </>
      ) : multiCount > 1 ? (
        <>
          <span className="selectionToolbarCount">{multiCount}{ja ? "件" : " selected"}</span>
          <button type="button" title={ja ? "複製" : "Duplicate"} aria-label={ja ? "複製" : "Duplicate"} onClick={onDuplicate}>⧉</button>
          <button type="button" title={ja ? "削除" : "Delete"} aria-label={ja ? "削除" : "Delete"} onClick={onDelete}>⌫</button>
        </>
      ) : (
        <>
          <button type="button" title={ja ? "8方向へ子を追加" : "Add child in 8 directions"} aria-label={ja ? "8方向へ子を追加" : "Add child in 8 directions"} onClick={onAddChild}>＋</button>
          {!isRoot ? <button type="button" title={ja ? "兄弟を追加" : "Add sibling"} aria-label={ja ? "兄弟を追加" : "Add sibling"} onClick={onAddSibling}>↳</button> : null}
          <button type="button" title={ja ? "編集" : "Edit"} aria-label={ja ? "編集" : "Edit"} onClick={onEdit}>✎</button>
          <button type="button" title={ja ? "その他" : "More actions"} aria-expanded={menuOpen} aria-label={ja ? "その他の操作" : "More actions"} onClick={onToggleMenu}>•••</button>
          {menuOpen ? (
            <div className="selectionToolbarMenu" role="menu">
              <button type="button" role="menuitem" onClick={onMemo}>{ja ? "メモ" : "Memo"}</button>
              <button type="button" role="menuitem" onClick={onColor}>{ja ? "色" : "Color"}</button>
              <button type="button" role="menuitem" onClick={onDuplicate}>{ja ? "複製" : "Duplicate"}</button>
              <button type="button" role="menuitem" onClick={onToggleCollapse}>{ja ? "枝を開閉" : "Toggle branch"}</button>
              <button type="button" role="menuitem" onClick={onFocus}>{ja ? "枝にフォーカス" : "Focus branch"}</button>
              {!isRoot ? <button type="button" role="menuitem" className="selectionToolbarDanger" onClick={onDelete}>{ja ? "削除" : "Delete"}</button> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
