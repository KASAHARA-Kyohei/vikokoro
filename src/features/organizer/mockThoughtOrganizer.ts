import type { ThoughtOrganizer } from "./types";

export function createMockThoughtOrganizer(): ThoughtOrganizer {
  return {
    async organize(request) {
      return {
        groups: request.cards.length > 0
          ? [{ title: "整理案", cardIds: request.cards.map((card) => card.id) }]
          : [],
        summary: `${request.cards.length}件のカードを仮のグループにまとめます。`,
      };
    },
  };
}
