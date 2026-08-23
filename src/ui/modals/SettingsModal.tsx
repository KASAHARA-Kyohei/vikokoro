import type { AppLanguage, ThemeName } from "../../hooks/useAppPreferences";
import { Dialog } from "../Dialog";
import "./SettingsModal.scss";

type Props = {
  open: boolean;
  language: AppLanguage;
  theme: ThemeName;
  onChangeLanguage: (language: AppLanguage) => void;
  onChangeTheme: (theme: ThemeName) => void;
  onClose: () => void;
};

export function SettingsModal({
  open,
  language,
  theme,
  onChangeLanguage,
  onChangeTheme,
  onClose,
}: Props) {
  const title = language === "ja" ? "設定" : "Settings";
  return (
    <Dialog open={open} title={title} className="settingsModal" isolateKeyboard onClose={onClose}>
        <p className="settingsIntro">{language === "ja" ? "表示と言語" : "Appearance and language"}</p>
        <div className="settingsGrid">
          <label>
            <span>{language === "ja" ? "言語" : "Language"}</span>
            <select value={language} onChange={(event) => onChangeLanguage(event.currentTarget.value as AppLanguage)}>
              <option value="ja">日本語</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            <span>{language === "ja" ? "テーマ" : "Theme"}</span>
            <select value={theme} onChange={(event) => onChangeTheme(event.currentTarget.value as ThemeName)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="ivory">Ivory</option>
              <option value="tokyoNight">Tokyo Night</option>
            </select>
          </label>
        </div>
        <div className="modalActions">
          <button type="button" className="modalButton" onClick={onClose}>
            {language === "ja" ? "閉じる" : "Close"}
          </button>
        </div>
    </Dialog>
  );
}
