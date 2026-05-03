import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LLM_SETTINGS,
  GEMINI_MODEL_OPTIONS,
  loadLlmSettings,
  parseErrorMessage,
  saveLlmSettings,
  testLlmConnection,
  type LlmProvider,
} from "../../features/llm/settingsRepository";
import { getLanguageLabel, getThemeLabel } from "../../i18n/uiText";
import type { AppLanguage, ThemeName } from "../../hooks/useAppPreferences";
import "./SettingsModal.scss";

type Feedback = {
  tone: "success" | "error" | "muted";
  message: string;
};

type Props = {
  open: boolean;
  language: AppLanguage;
  theme: ThemeName;
  onChangeLanguage: (language: AppLanguage) => void;
  onChangeTheme: (theme: ThemeName) => void;
  onClose: () => void;
};

const THEME_OPTIONS: ThemeName[] = ["dark", "light", "ivory", "tokyoNight"];

export function SettingsModal({
  open,
  language,
  theme,
  onChangeLanguage,
  onChangeTheme,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [provider, setProvider] = useState<LlmProvider>(DEFAULT_LLM_SETTINGS.provider);
  const [model, setModel] = useState(DEFAULT_LLM_SETTINGS.model);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [clearStoredKey, setClearStoredKey] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [tauriUnavailable, setTauriUnavailable] = useState(false);

  const text = useMemo(() => {
    if (language === "ja") {
      return {
        title: "設定",
        generalSection: "一般",
        generalTitle: "表示設定",
        generalHint: "言語とテーマは変更するとすぐ反映されます。",
        languageLabel: "言語",
        themeLabel: "テーマ",
        aiSection: "AI設定",
        aiTitle: "接続とモデル",
        aiHint:
          "APIキーは OS の認証情報ストレージに保存され、使えない場合は AppData に保存されます。",
        providerLabel: "サービス",
        modelLabel: "モデル",
        apiKeyLabel: "APIキー",
        apiKeyPlaceholderKeep: "空欄のままで現在のキーを維持",
        apiKeyPlaceholderPaste: "Gemini APIキーを貼り付け",
        showKey: "キーを表示",
        storedKeyConfigured: "設定済み",
        storedKeyNotSet: "未設定",
        storedKeyLabel: "保存済みキー",
        removeStoredKey: "保存済みキーを削除して保存",
        tauriOnly: "AI設定は Tauri で起動したアプリでのみ利用できます。",
        saveSuccess: "AI設定を保存しました。",
        testConnection: "接続テスト",
        testing: "テスト中...",
        save: "保存",
        saving: "保存中...",
        close: "閉じる (Esc)",
      };
    }
    return {
      title: "Settings",
      generalSection: "General",
      generalTitle: "Display",
      generalHint: "Language and theme changes are applied immediately.",
      languageLabel: "Language",
      themeLabel: "Theme",
      aiSection: "AI Settings",
      aiTitle: "Connection & model",
      aiHint:
        "API keys are stored in OS credential storage, or AppData when that is unavailable.",
      providerLabel: "Service",
      modelLabel: "Model",
      apiKeyLabel: "API key",
      apiKeyPlaceholderKeep: "Leave empty to keep the current key",
      apiKeyPlaceholderPaste: "Paste a Gemini API key",
      showKey: "Show key",
      storedKeyConfigured: "Configured",
      storedKeyNotSet: "Not set",
      storedKeyLabel: "Stored key",
      removeStoredKey: "Remove stored key on save",
      tauriOnly: "AI settings are only available when the app is launched with Tauri.",
      saveSuccess: "AI settings saved.",
      testConnection: "Test Connection",
      testing: "Testing...",
      save: "Save",
      saving: "Saving...",
      close: "Close (Esc)",
    };
  }, [language]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setFeedback(null);
    setTauriUnavailable(false);
    setApiKey("");
    setShowApiKey(false);
    setClearStoredKey(false);

    const run = async () => {
      try {
        const loaded = await loadLlmSettings();
        if (cancelled) return;
        setProvider(loaded.provider);
        setModel(loaded.model);
        setHasStoredKey(loaded.hasApiKey);
      } catch {
        if (cancelled) return;
        setProvider(DEFAULT_LLM_SETTINGS.provider);
        setModel(DEFAULT_LLM_SETTINGS.model);
        setHasStoredKey(false);
        setTauriUnavailable(true);
        setFeedback({
          tone: "error",
          message: text.tauriOnly,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, text.tauriOnly]);

  const modelOptions = useMemo(() => {
    if (GEMINI_MODEL_OPTIONS.includes(model as (typeof GEMINI_MODEL_OPTIONS)[number])) {
      return GEMINI_MODEL_OPTIONS;
    }
    return [model, ...GEMINI_MODEL_OPTIONS];
  }, [model]);

  if (!open) return null;

  const apiKeyForRequest = apiKey.trim();
  const canTest = !loading && !testing && !tauriUnavailable && (apiKeyForRequest !== "" || hasStoredKey);
  const canSave = !loading && !saving && !tauriUnavailable;

  const handleTest = async () => {
    setFeedback(null);
    setTesting(true);
    try {
      const result = await testLlmConnection({
        provider,
        model,
        apiKey: apiKeyForRequest === "" ? undefined : apiKeyForRequest,
      });
      setFeedback({
        tone: result.ok ? "success" : "error",
        message: result.message,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: parseErrorMessage(error),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setFeedback(null);
    setSaving(true);
    try {
      const next = await saveLlmSettings({
        provider,
        model,
        apiKey: apiKeyForRequest !== "" ? apiKeyForRequest : clearStoredKey ? "" : undefined,
      });
      setHasStoredKey(next.hasApiKey);
      setClearStoredKey(false);
      setApiKey("");
      setFeedback({
        tone: "success",
        message: text.saveSuccess,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: parseErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  };

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
        className="modal settingsModal"
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="modalTitle">{text.title}</div>
        <div className="modalBody">
          <div className="settingsSection">
            <div className="settingsSectionEyebrow">{text.generalSection}</div>
            <div className="settingsSectionTitle">{text.generalTitle}</div>
            <div className="settingsSectionHint">{text.generalHint}</div>

            <div className="settingsFieldGrid">
              <label className="settingsField">
                <span className="settingsLabel">{text.languageLabel}</span>
                <select
                  className="settingsSelect"
                  value={language}
                  onChange={(e) => onChangeLanguage(e.currentTarget.value as AppLanguage)}
                >
                  <option value="ja">{getLanguageLabel("ja", language)}</option>
                  <option value="en">{getLanguageLabel("en", language)}</option>
                </select>
              </label>

              <label className="settingsField">
                <span className="settingsLabel">{text.themeLabel}</span>
                <select
                  className="settingsSelect"
                  value={theme}
                  onChange={(e) => onChangeTheme(e.currentTarget.value as ThemeName)}
                >
                  {THEME_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {getThemeLabel(option, language)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="settingsSection">
            <div className="settingsSectionEyebrow">{text.aiSection}</div>
            <div className="settingsSectionTitle">{text.aiTitle}</div>
            <div className="settingsSectionHint">{text.aiHint}</div>

            <div className="settingsFieldList">
              <label className="settingsField">
                <span className="settingsLabel">{text.providerLabel}</span>
                <select
                  className="settingsSelect"
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.currentTarget.value as LlmProvider);
                  }}
                  disabled={loading || tauriUnavailable}
                >
                  <option value="gemini">Gemini</option>
                </select>
              </label>

              <label className="settingsField">
                <span className="settingsLabel">{text.modelLabel}</span>
                <select
                  className="settingsSelect"
                  value={model}
                  onChange={(e) => {
                    setModel(e.currentTarget.value);
                  }}
                  disabled={loading || tauriUnavailable}
                >
                  {modelOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>

              <label className="settingsField">
                <span className="settingsLabel">{text.apiKeyLabel}</span>
                <input
                  className="settingsInput"
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  placeholder={
                    hasStoredKey ? text.apiKeyPlaceholderKeep : text.apiKeyPlaceholderPaste
                  }
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setApiKey(value);
                    if (value.trim() !== "") {
                      setClearStoredKey(false);
                    }
                  }}
                  disabled={loading || tauriUnavailable}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>

              <div className="settingsInlineRow">
                <label className="settingsInlineLabel">
                  <input
                    type="checkbox"
                    checked={showApiKey}
                    onChange={(e) => setShowApiKey(e.currentTarget.checked)}
                    disabled={loading}
                  />
                  <span>{text.showKey}</span>
                </label>
                <div className="settingsStoredState">
                  {text.storedKeyLabel}: {hasStoredKey ? text.storedKeyConfigured : text.storedKeyNotSet}
                </div>
              </div>

              <label className="settingsInlineLabel">
                <input
                  type="checkbox"
                  checked={clearStoredKey}
                  onChange={(e) => setClearStoredKey(e.currentTarget.checked)}
                  disabled={loading || tauriUnavailable || !hasStoredKey || apiKeyForRequest !== ""}
                />
                <span>{text.removeStoredKey}</span>
              </label>

              {feedback ? (
                <div className={"settingsFeedback settingsFeedback-" + feedback.tone}>
                  {feedback.message}
                </div>
              ) : null}
            </div>

            <div className="settingsSectionActions">
              <button
                type="button"
                className="modalButton"
                onMouseDown={(e) => {
                  e.preventDefault();
                  void handleTest();
                }}
                disabled={!canTest}
              >
                {testing ? text.testing : text.testConnection}
              </button>
              <button
                type="button"
                className="modalButton"
                onMouseDown={(e) => {
                  e.preventDefault();
                  void handleSave();
                }}
                disabled={!canSave}
              >
                {saving ? text.saving : text.save}
              </button>
            </div>
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
