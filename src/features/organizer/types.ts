export type OrganizeRequest = {
  cards: Array<{ id: string; text: string }>;
  instruction: string;
};

export type OrganizeSuggestion = {
  groups: Array<{ title: string; cardIds: string[] }>;
  summary?: string;
  additionalQuestions?: string[];
};

export interface ThoughtOrganizer {
  organize(request: OrganizeRequest): Promise<OrganizeSuggestion>;
}

export type OrganizePreview = {
  request: OrganizeRequest;
  suggestion: OrganizeSuggestion;
};
