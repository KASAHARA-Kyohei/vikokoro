import type { DocId, Document, Mode, Tab } from "./types";
import type { AppLanguage } from "../hooks/useAppPreferences";
import { APP_TEXT } from "../i18n/uiText";
import "./TabBar.scss";

type Props = {
  tabs: Tab[];
  activeDocId: DocId;
  documents: Record<DocId, Document>;
  mode: Mode;
  disabled: boolean;
  onSelect: (docId: DocId) => void;
  onNew: () => void;
  onRequestClose: (docId: DocId) => void;
  language: AppLanguage;
};

function getTabTitle(doc: Document | undefined, language: AppLanguage): string {
  const labels = APP_TEXT[language].tabs;
  if (!doc) return labels.missing;
  const root = doc.nodes[doc.rootId];
  const rootText = root?.text ?? "";
  return rootText.trim() === "" ? labels.untitled : rootText;
}

export function TabBar({
  tabs,
  activeDocId,
  documents,
  mode,
  disabled,
  onSelect,
  onNew,
  onRequestClose,
  language,
}: Props) {
  return (
    <div className="tabBar">
      <div className="tabList" role="tablist" aria-label={language === "ja" ? "マインドマップのタブ" : "Mind map tabs"}>
        {tabs.map((tab) => {
          const isActive = tab.docId === activeDocId;
          const title = getTabTitle(documents[tab.docId], language);
          return (
            <div key={tab.docId} className="tabItem">
            <button
              role="tab"
              aria-selected={isActive}
              className={"tab" + (isActive ? " tabActive" : "")}
              onClick={() => {
                if (disabled || mode === "insert") return;
                onSelect(tab.docId);
              }}
              type="button"
            >
              {title}
            </button>
            {tabs.length > 1 ? (
              <button
                type="button"
                className="tabClose"
                aria-label={APP_TEXT[language].tabs.close}
                title={APP_TEXT[language].tabs.close}
                disabled={disabled || mode === "insert"}
                onClick={() => onRequestClose(tab.docId)}
              >
                ×
              </button>
            ) : null}
            </div>
          );
        })}
      </div>
      <div className="tabActions">
        <button
          className="tabNew"
          aria-label={APP_TEXT[language].tabs.new}
          title={APP_TEXT[language].tabs.new}
          onClick={() => {
            if (disabled || mode === "insert") return;
            onNew();
          }}
          type="button"
        >
          +
        </button>
      </div>
    </div>
  );
}
