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
import "./LlmSettingsModal.scss";

type Feedback = {
  tone: "success" | "error" | "muted";
  message: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function LlmSettingsModal({ open, onClose }: Props) {
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
      } catch (error) {
        if (cancelled) return;
        setProvider(DEFAULT_LLM_SETTINGS.provider);
        setModel(DEFAULT_LLM_SETTINGS.model);
        setHasStoredKey(false);
        setTauriUnavailable(true);
        setFeedback({
          tone: "error",
          message: "Tauriで起動したアプリでのみLLM設定を利用できます。",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open]);

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
        apiKey:
          apiKeyForRequest !== "" ? apiKeyForRequest : clearStoredKey ? "" : undefined,
      });
      setHasStoredKey(next.hasApiKey);
      setClearStoredKey(false);
      setApiKey("");
      setFeedback({
        tone: "success",
        message: "設定を保存しました。",
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
        className="modal llmSettingsModal"
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="modalTitle">LLM settings</div>
        <div className="modalBody">
          <div className="llmFieldList">
            <label className="llmField">
              <span className="llmLabel">Provider</span>
              <select
                className="llmSelect"
                value={provider}
                onChange={(e) => {
                  setProvider(e.currentTarget.value as LlmProvider);
                }}
                disabled={loading || tauriUnavailable}
              >
                <option value="gemini">Gemini</option>
              </select>
            </label>

            <label className="llmField">
              <span className="llmLabel">Model</span>
              <select
                className="llmSelect"
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

            <label className="llmField">
              <span className="llmLabel">API key</span>
              <input
                className="llmInput"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                placeholder={hasStoredKey ? "Leave empty to keep current key" : "Paste Gemini API key"}
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

            <div className="llmInlineRow">
              <label className="llmInlineLabel">
                <input
                  type="checkbox"
                  checked={showApiKey}
                  onChange={(e) => setShowApiKey(e.currentTarget.checked)}
                  disabled={loading}
                />
                <span>Show key</span>
              </label>
              <div className="llmStoredState">
                Stored key: {hasStoredKey ? "Configured" : "Not set"}
              </div>
            </div>

            <label className="llmInlineLabel">
              <input
                type="checkbox"
                checked={clearStoredKey}
                onChange={(e) => setClearStoredKey(e.currentTarget.checked)}
                disabled={loading || tauriUnavailable || !hasStoredKey || apiKeyForRequest !== ""}
              />
              <span>Remove stored key on save</span>
            </label>

            {feedback ? (
              <div className={"llmFeedback llmFeedback-" + feedback.tone}>{feedback.message}</div>
            ) : (
              <div className="llmFeedback llmFeedback-muted">
                API key is stored in OS credential storage (or AppData fallback). Model choice is
                stored in AppData.
              </div>
            )}
          </div>
        </div>

        <div className="modalActions">
          <button
            type="button"
            className="modalButton"
            onMouseDown={(e) => {
              e.preventDefault();
              void handleTest();
            }}
            disabled={!canTest}
          >
            {testing ? "Testing..." : "Test Connection"}
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
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            className="modalButton"
            onMouseDown={(e) => {
              e.preventDefault();
              onClose();
            }}
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
