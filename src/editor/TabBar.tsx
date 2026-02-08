import type { DocId, Document, Mode, Tab } from "./types";
import type { ThemeName } from "../hooks/useTheme";

type Props = {
  tabs: Tab[];
  activeDocId: DocId;
  documents: Record<DocId, Document>;
  mode: Mode;
  disabled: boolean;
  onSelect: (docId: DocId) => void;
  onNew: () => void;
  theme: ThemeName;
  onCycleTheme: () => void;
};

function getTabTitle(doc: Document | undefined): string {
  if (!doc) return "(missing)";
  const root = doc.nodes[doc.rootId];
  const text = root?.text ?? "";
  return text.trim() === "" ? "Untitled" : text;
}

function getThemeLabel(theme: ThemeName): string {
  if (theme === "dark") return "Dark";
  if (theme === "light") return "Light";
  if (theme === "ivory") return "Ivory";
  return "Tokyo Night";
}

export function TabBar({
  tabs,
  activeDocId,
  documents,
  mode,
  disabled,
  onSelect,
  onNew,
  theme,
  onCycleTheme,
}: Props) {
  return (
    <div className="tabBar">
      <div className="tabList">
        {tabs.map((tab) => {
          const isActive = tab.docId === activeDocId;
          const title = getTabTitle(documents[tab.docId]);
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
          className="tabTheme"
          onMouseDown={(e) => {
            e.preventDefault();
            if (disabled || mode === "insert") return;
            onCycleTheme();
          }}
          type="button"
        >
          Theme: {getThemeLabel(theme)}
        </button>
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
