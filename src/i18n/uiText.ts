import type { Mode } from "../editor/types";
import type { AppLanguage, ThemeName } from "../hooks/useAppPreferences";

type SaveStatusLabel = "saved" | "saving" | "unavailable";
type AiRunningMode = "generate" | "improve" | "review";

export const APP_TEXT = {
  ja: {
    loadingWorkspace: "ワークスペースを読み込み中...",
    footer: {
      aiAssist: "AI支援",
      settings: "設定",
      help: "ヘルプ",
    },
    status: {
      mode: "モード",
      doc: "文書",
      save: "保存",
      ai: "AI",
      jump: "ジャンプ",
    },
    tabs: {
      untitled: "無題",
      missing: "(不明)",
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
      settingsSubtitle: "言語 / テーマ / AI設定",
      aiGenerateTitle: "AIでマップ生成",
      aiGenerateSubtitle: "トピックから現在タブを置き換える",
      aiImproveTitle: "AIでマップ改善",
      aiImproveSubtitle: "現在タブへ改善差分を提案する",
      aiReviewTitle: "AIでマップレビュー",
      aiReviewSubtitle: "漏れ・曖昧さ・次のアクションを確認する",
      moveNodeLeftTitle: "ノードを左へ移動",
      moveNodeLeftSubtitle: "Shift+H（アウトデント）",
      moveNodeRightTitle: "ノードを右へ移動",
      moveNodeRightSubtitle: "Shift+L（インデント）",
    },
  },
  en: {
    loadingWorkspace: "Loading workspace...",
    footer: {
      aiAssist: "AI Assist",
      settings: "Settings",
      help: "Help",
    },
    status: {
      mode: "Mode",
      doc: "Doc",
      save: "Save",
      ai: "AI",
      jump: "Jump",
    },
    tabs: {
      untitled: "Untitled",
      missing: "(missing)",
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
      settingsSubtitle: "Language / Theme / AI Settings",
      aiGenerateTitle: "Generate map with AI",
      aiGenerateSubtitle: "Replace the current tab from a topic",
      aiImproveTitle: "Improve map with AI",
      aiImproveSubtitle: "Suggest improvement diffs for the current tab",
      aiReviewTitle: "Review current map with AI",
      aiReviewSubtitle: "Check gaps, ambiguity, and next actions",
      moveNodeLeftTitle: "Move node left",
      moveNodeLeftSubtitle: "Shift+H (outdent)",
      moveNodeRightTitle: "Move node right",
      moveNodeRightSubtitle: "Shift+L (indent)",
    },
  },
} as const;

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
    unavailable: "ローカル",
  },
  en: {
    saved: "Saved",
    saving: "Saving…",
    unavailable: "Local",
  },
};

const AI_RUNNING_LABELS: Record<AppLanguage, Record<AiRunningMode, string>> = {
  ja: {
    generate: "生成中",
    improve: "改善中",
    review: "レビュー中",
  },
  en: {
    generate: "Generating",
    improve: "Improving",
    review: "Reviewing",
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

export function getAiRunningLabel(mode: AiRunningMode, language: AppLanguage): string {
  return AI_RUNNING_LABELS[language][mode];
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
