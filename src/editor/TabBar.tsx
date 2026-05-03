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
  language,
}: Props) {
  return (
    <div className="tabBar">
      <div className="tabList">
        {tabs.map((tab) => {
          const isActive = tab.docId === activeDocId;
          const title = getTabTitle(documents[tab.docId], language);
          return (
            <button
              key={tab.docId}
              className={"tab" + (isActive ? " tabActive" : "")}
              onMouseDown={(e) => {
                e.preventDefault();
                if (disabled || mode === "insert") return;
                onSelect(tab.docId);
              }}
              type="button"
            >
              {title}
            </button>
          );
        })}
      </div>
      <div className="tabActions">
        <button
          className="tabNew"
          onMouseDown={(e) => {
            e.preventDefault();
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
