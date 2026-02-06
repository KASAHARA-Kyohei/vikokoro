import type { Document, NodeId } from "../../editor/types";

export type SearchResult = {
  nodeId: NodeId;
  title: string;
  subtitle: string;
  depth: number;
};

function getNodePath(doc: Document, nodeId: NodeId): { subtitle: string; depth: number } {
  const labels: string[] = [];
  let depth = 0;
  let current = doc.nodes[nodeId];
  while (current) {
    labels.push(current.text.trim() === "" ? "(empty)" : current.text.trim());
    if (!current.parentId) break;
    current = doc.nodes[current.parentId];
    depth += 1;
    if (depth > 1000) break;
  }

  labels.reverse();
  const ancestors = labels.slice(0, -1);
  if (ancestors.length === 0) {
    return { subtitle: "Path: Root", depth: 0 };
  }
  if (ancestors.length > 3) {
    const tail = ancestors.slice(-3);
    return { subtitle: `Path: ${["…", ...tail].join(" › ")}`, depth };
  }
  return { subtitle: `Path: ${ancestors.join(" › ")}`, depth };
}

export function buildSearchResults(doc: Document, query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];

  const results = Object.values(doc.nodes)
    .filter((node) => node.text.toLowerCase().includes(q))
    .map((node) => {
      const { subtitle, depth } = getNodePath(doc, node.id);
      return {
        nodeId: node.id,
        title: node.text.trim() || "(empty)",
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

