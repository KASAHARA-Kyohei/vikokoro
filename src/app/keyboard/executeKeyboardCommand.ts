import type { EditorAction } from "../../editor/state";
import type { SpatialDirection } from "../../editor/domain/spatialNavigation";
import type { KeyboardCommand } from "./types";

type CommandExecutor = {
  dispatch: (action: EditorAction) => void;
  setHelpOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setPaletteQuery: (query: string) => void;
  setPaletteIndex: (index: number) => void;
  setNodeColorOpen: (open: boolean) => void;
  setNodeMemoOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setJumpPrefix: (prefix: string) => void;
  openJump: () => void;
  openRelatedLinkJump: () => void;
  closeJump: () => void;
  selectNode: (nodeId: string) => void;
  nudgeSelection: (dx: number, dy: number) => void;
  moveCursorVisual: (direction: SpatialDirection) => void;
};

export function executeKeyboardCommand(command: KeyboardCommand, executor: CommandExecutor): void {
  switch (command.type) {
    case "none":
    case "preventOnly":
      return;
    case "multi":
      for (const next of command.commands) {
        executeKeyboardCommand(next, executor);
      }
      return;
    case "dispatch":
      executor.dispatch(command.action);
      return;
    case "selectNode":
      executor.selectNode(command.nodeId);
      return;
    case "setCursorColor":
      executor.dispatch({ type: "setCursorColor", color: command.color });
      return;
    case "setHelpOpen":
      executor.setHelpOpen(command.open);
      return;
    case "setSearchOpen":
      executor.setSearchOpen(command.open);
      return;
    case "setPaletteOpen":
      executor.setPaletteOpen(command.open);
      return;
    case "setPaletteQuery":
      executor.setPaletteQuery(command.query);
      return;
    case "setPaletteIndex":
      executor.setPaletteIndex(command.index);
      return;
    case "setNodeColorOpen":
      executor.setNodeColorOpen(command.open);
      return;
    case "setNodeMemoOpen":
      executor.setNodeMemoOpen(command.open);
      return;
    case "setSettingsOpen":
      executor.setSettingsOpen(command.open);
      return;
    case "setJumpPrefix":
      executor.setJumpPrefix(command.prefix);
      return;
    case "openJump":
      executor.openJump();
      return;
    case "openRelatedLinkJump":
      executor.openRelatedLinkJump();
      return;
    case "closeJump":
      executor.closeJump();
      return;
    case "nudgeSelection":
      executor.nudgeSelection(command.dx, command.dy);
      return;
    case "moveCursorVisual":
      executor.moveCursorVisual(command.direction);
      return;
    default:
      return;
  }
}
