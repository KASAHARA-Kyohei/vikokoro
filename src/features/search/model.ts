import type { Document, NodeId } from "../../editor/types";
import type { AppLanguage } from "../../hooks/useAppPreferences";
import {
  getEmptyNodeLabel,
  getSearchPathPrefix,
  getSearchRootLabel,
} from "../../i18n/uiText";

export type SearchResult = {
  nodeId: NodeId;
  title: string;
  subtitle: string;
  depth: number;
};

function getNodePath(
  doc: Document,
  nodeId: NodeId,
  language: AppLanguage,
): { subtitle: string; depth: number } {
  const labels: string[] = [];
  let depth = 0;
  let current = doc.nodes[nodeId];
  while (current) {
    labels.push(current.text.trim() === "" ? getEmptyNodeLabel(language) : current.text.trim());
    if (!current.parentId) break;
    current = doc.nodes[current.parentId];
    depth += 1;
    if (depth > 1000) break;
  }

  labels.reverse();
  const ancestors = labels.slice(0, -1);
  if (ancestors.length === 0) {
    return {
      subtitle: `${getSearchPathPrefix(language)}: ${getSearchRootLabel(language)}`,
      depth: 0,
    };
  }
  if (ancestors.length > 3) {
    const tail = ancestors.slice(-3);
    return {
      subtitle: `${getSearchPathPrefix(language)}: ${["…", ...tail].join(" › ")}`,
      depth,
    };
  }
  return { subtitle: `${getSearchPathPrefix(language)}: ${ancestors.join(" › ")}`, depth };
}

export function buildSearchResults(
  doc: Document,
  query: string,
  language: AppLanguage = "en",
): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];

  const results = Object.values(doc.nodes)
    .filter((node) => node.text.toLowerCase().includes(q))
    .map((node) => {
      const { subtitle, depth } = getNodePath(doc, node.id, language);
      return {
        nodeId: node.id,
        title: node.text.trim() || getEmptyNodeLabel(language),
        subtitle,
        depth,
      };
    });

  results.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.title.localeCompare(b.title);
  });

  return results;
}
