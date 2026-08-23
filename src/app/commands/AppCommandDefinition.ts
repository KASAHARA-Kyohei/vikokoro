export type AppCommandId =
  | "newDocument"
  | "closeDocument"
  | "undo"
  | "redo"
  | "duplicateSelection"
  | "deleteSelection";

export type AppCommandDefinition = {
  id: AppCommandId;
  title: string;
  shortcut?: string;
  isEnabled: boolean;
  run: () => void;
};
