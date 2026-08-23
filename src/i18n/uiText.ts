import type { Mode } from "../editor/types";
import type { AppLanguage, ThemeName } from "../hooks/useAppPreferences";
import type { PersistenceIssue } from "../persistence/types";

export type SaveStatusLabel = "saved" | "saving" | "error" | "unavailable";

export const APP_TEXT = {
  ja: {
    loadingWorkspace: "ワークスペースを読み込み中...",
    footer: {
      settings: "設定",
      help: "ヘルプ",
    },
    status: {
      mode: "モード",
      doc: "文書",
      save: "保存",
      jump: "ジャンプ",
      sticky: "付箋",
      stickyPlacement: "配置中",
    },
    hints: {
      normal: "hjkl: 画面方向移動 · 矢印: 階層移動 · a: 8方向追加",
      insert: "入力中: Enterで確定 · Tabで子ノード · Escで取消",
      direction: "方向を選択: Q/W/E/A/D/Z/X/C · Escで取消",
      sticky: "付箋を配置中: 空白をダブルクリックで配置 · Escで取消",
      selected: "選択中: 近くの操作バーで追加・編集 · ?で全操作",
    },
    canvas: {
      label: "マインドマップキャンバス",
      emptyRoot: "中心テーマを入力",
      undo: "元に戻す",
      redo: "やり直す",
      centerSelected: "選択を中央",
      centerRoot: "ルートを中央",
      fit: "全体表示",
      view: "表示",
      zoomOut: "ズームアウト",
      resetZoom: "ズームをリセット",
      zoomIn: "ズームイン",
    },
    onboarding: {
      topic: "まず、中心テーマを入力しましょう",
      branch: "次に、最初の枝を追加しましょう",
      arrange: "ドラッグで配置を整えられます",
      addBranch: "＋で枝を追加",
      finish: "ガイドを終了",
      typeTopic: "中央の入力欄にテーマを入力し、Enterで確定してください。",
      detail: "Space＋ドラッグでパン、?ですべての操作を確認できます。",
    },
    tabs: {
      untitled: "無題",
      missing: "(不明)",
      new: "新規マップを作成",
      close: "このタブを閉じる",
    },
    focus: {
      breadcrumbLabel: "フォーカス中の階層",
      all: "全体",
      empty: "(空)",
      exitHint: "Escで全体表示",
    },
    palette: {
      newTabTitle: "新規タブ",
      newTabSubtitle: "Ctrl+T",
      closeTabTitle: "タブを閉じる",
      closeTabSubtitle: "Ctrl+W",
      searchTitle: "検索",
      searchSubtitle: "Ctrl+F",
      helpTitle: "ヘルプ",
      helpSubtitle: "?",
      settingsTitle: "設定",
      settingsSubtitle: "言語 / テーマ",
      addRelatedLinkTitle: "補助線を追加",
      addRelatedLinkSubtitle: "選択ノードから検索したノードへ接続",
      deleteRelatedLinkTitle: "選択した補助線を削除",
      deleteRelatedLinkSubtitle: "Delete / dd",
      addStickyNoteTitle: "付箋を追加",
      addStickyNoteSubtitle: "空白ダブルクリックで配置、Escで解除",
      moveNodeLeftTitle: "ノードを左へ移動",
      moveNodeLeftSubtitle: "Shift+H（アウトデント）",
      moveNodeRightTitle: "ノードを右へ移動",
      moveNodeRightSubtitle: "Shift+L（インデント）",
      toggleCollapseTitle: "枝の開閉を切り替え",
      collapseBranchTitle: "枝を折りたたむ",
      expandBranchTitle: "枝を展開する",
      collapseAllTitle: "表示中の枝をすべて折りたたむ",
      expandAllTitle: "表示中の枝をすべて展開する",
      focusBranchTitle: "選択した枝にフォーカス",
      exitFocusTitle: "フォーカスを終了",
      layoutBranchTitle: "選択した枝を自動整列",
      layoutAllTitle: "マップ全体を自動整列",
      resetConnectorAnchorsTitle: "選択した接続線を自動接続へ戻す",
      resetConnectorAnchorsSubtitle: "親子線を選択中のみ",
      organizePreviewTitle: "整理案（試験機能）",
      organizePreviewSubtitle: "複数の内容があるノードを選択したときにプレビューを表示",
    },
  },
  en: {
    loadingWorkspace: "Loading workspace...",
    footer: {
      settings: "Settings",
      help: "Help",
    },
    status: {
      mode: "Mode",
      doc: "Doc",
      save: "Save",
      jump: "Jump",
      sticky: "Sticky",
      stickyPlacement: "Placing",
    },
    hints: {
      normal: "HJKL: move by screen direction · Arrows: tree navigation · A: add in 8 directions",
      insert: "Insert mode: Enter to commit · Tab for child · Esc to cancel",
      direction: "Choose a direction: Q/W/E/A/D/Z/X/C · Esc to cancel",
      sticky: "Placing a sticky note: double-click blank space · Esc to cancel",
      selected: "Selected: use the nearby toolbar to add or edit · ? for all shortcuts",
    },
    canvas: {
      label: "Mind map canvas",
      emptyRoot: "Enter a central topic",
      undo: "Undo",
      redo: "Redo",
      centerSelected: "Center selection",
      centerRoot: "Center root",
      fit: "Fit map",
      view: "View",
      zoomOut: "Zoom out",
      resetZoom: "Reset zoom",
      zoomIn: "Zoom in",
    },
    onboarding: {
      topic: "Start by naming the central topic",
      branch: "Add the first branch next",
      arrange: "Drag to arrange your ideas",
      addBranch: "Add a branch with +",
      finish: "Finish guide",
      typeTopic: "Type a topic in the central field, then press Enter.",
      detail: "Space + drag pans the canvas. Press ? to see every shortcut.",
    },
    tabs: {
      untitled: "Untitled",
      missing: "(missing)",
      new: "Create a new map",
      close: "Close this tab",
    },
    focus: {
      breadcrumbLabel: "Focused branch path",
      all: "All",
      empty: "(empty)",
      exitHint: "Esc to show all",
    },
    palette: {
      newTabTitle: "New tab",
      newTabSubtitle: "Ctrl+T",
      closeTabTitle: "Close tab",
      closeTabSubtitle: "Ctrl+W",
      searchTitle: "Search",
      searchSubtitle: "Ctrl+F",
      helpTitle: "Help",
      helpSubtitle: "?",
      settingsTitle: "Settings",
      settingsSubtitle: "Language / Theme",
      addRelatedLinkTitle: "Add related link",
      addRelatedLinkSubtitle: "Connect the selected node to a searched node",
      deleteRelatedLinkTitle: "Delete selected related link",
      deleteRelatedLinkSubtitle: "Delete / dd",
      addStickyNoteTitle: "Add sticky note",
      addStickyNoteSubtitle: "Place with blank double-click, Esc to exit",
      moveNodeLeftTitle: "Move node left",
      moveNodeLeftSubtitle: "Shift+H (outdent)",
      moveNodeRightTitle: "Move node right",
      moveNodeRightSubtitle: "Shift+L (indent)",
      toggleCollapseTitle: "Toggle branch collapse",
      collapseBranchTitle: "Collapse branch",
      expandBranchTitle: "Expand branch",
      collapseAllTitle: "Collapse all visible branches",
      expandAllTitle: "Expand all visible branches",
      focusBranchTitle: "Focus selected branch",
      exitFocusTitle: "Exit focus",
      layoutBranchTitle: "Auto-layout selected branch",
      layoutAllTitle: "Auto-layout entire map",
      resetConnectorAnchorsTitle: "Reset selected connector to auto",
      resetConnectorAnchorsSubtitle: "Available when an edge is selected",
      organizePreviewTitle: "Organize preview (experimental)",
      organizePreviewSubtitle: "Preview suggestions for multiple non-empty selected nodes",
    },
  },
} as const;

export function getContextualHint(
  language: AppLanguage,
  options: {
    mode: Mode;
    directionPickerOpen: boolean;
    stickyPlacementActive: boolean;
    selectedCount: number;
  },
): string {
  const hints = APP_TEXT[language].hints;
  if (options.directionPickerOpen) return hints.direction;
  if (options.stickyPlacementActive) return hints.sticky;
  if (options.mode === "insert") return hints.insert;
  if (options.selectedCount > 0) return hints.selected;
  return hints.normal;
}

export function getPersistenceIssueLabel(issue: PersistenceIssue, language: AppLanguage): string {
  const labels = language === "ja"
    ? {
        corrupt: "保存データが破損しています。元ファイルは上書きしていません。",
        "invalid-schema": "保存データの構造が正しくありません。再試行するか新規開始してください。",
        io: "保存データを読み込めませんでした。ファイル権限や保存先を確認してください。",
        unavailable: "ブラウザモードでは端末へ保存されません。",
      }
    : {
        corrupt: "Saved data is corrupted. The original file has not been overwritten.",
        "invalid-schema": "Saved data has an invalid structure. Retry or start a new workspace.",
        io: "Saved data could not be loaded. Check file permissions and the storage location.",
        unavailable: "Browser mode does not persist data to your device.",
      };
  return labels[issue.code];
}

const THEME_LABELS: Record<AppLanguage, Record<ThemeName, string>> = {
  ja: {
    dark: "ダーク",
    light: "ライト",
    ivory: "アイボリー",
    tokyoNight: "Tokyo Night",
  },
  en: {
    dark: "Dark",
    light: "Light",
    ivory: "Ivory",
    tokyoNight: "Tokyo Night",
  },
};

const LANGUAGE_LABELS: Record<AppLanguage, Record<AppLanguage, string>> = {
  ja: {
    ja: "日本語",
    en: "English",
  },
  en: {
    ja: "Japanese",
    en: "English",
  },
};

const MODE_LABELS: Record<AppLanguage, Record<Mode, string>> = {
  ja: {
    normal: "通常",
    insert: "入力",
  },
  en: {
    normal: "NORMAL",
    insert: "INSERT",
  },
};

const SAVE_STATUS_LABELS: Record<AppLanguage, Record<SaveStatusLabel, string>> = {
  ja: {
    saved: "保存済み",
    saving: "保存中…",
    error: "保存失敗・再試行",
    unavailable: "保存なし（ブラウザ）",
  },
  en: {
    saved: "Saved",
    saving: "Saving…",
    error: "Save failed · Retry",
    unavailable: "Not saved (browser)",
  },
};

export function getThemeLabel(theme: ThemeName, language: AppLanguage): string {
  return THEME_LABELS[language][theme];
}

export function getLanguageLabel(value: AppLanguage, language: AppLanguage): string {
  return LANGUAGE_LABELS[language][value];
}

export function getModeLabel(mode: Mode, language: AppLanguage): string {
  return MODE_LABELS[language][mode];
}

export function getSaveStatusLabel(
  saveStatus: SaveStatusLabel,
  language: AppLanguage,
): string {
  return SAVE_STATUS_LABELS[language][saveStatus];
}

export function getEmptyNodeLabel(language: AppLanguage): string {
  return language === "ja" ? "(空)" : "(empty)";
}

export function getSearchPathPrefix(language: AppLanguage): string {
  return language === "ja" ? "パス" : "Path";
}

export function getSearchRootLabel(language: AppLanguage): string {
  return language === "ja" ? "ルート" : "Root";
}
