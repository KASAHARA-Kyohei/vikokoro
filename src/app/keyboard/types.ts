import type { EditorAction } from "../../editor/state";
import type { Mode, NodeColor, NodeId } from "../../editor/types";
import type { JumpSession } from "../../features/jump/model";

export type KeyboardInput = {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

export type KeyboardResolverContext = {
  mode: Mode;
  helpOpen: boolean;
  searchOpen: boolean;
  paletteOpen: boolean;
  nodeColorOpen: boolean;
  nodeMemoOpen: boolean;
  settingsOpen: boolean;
  closeConfirmOpen: boolean;
  focusActive: boolean;
  jumpSession: JumpSession | null;
  jumpPrefix: string;
};

export type KeyboardCommand =
  | { type: "none" }
  | { type: "preventOnly" }
  | { type: "setHelpOpen"; open: boolean }
  | { type: "setSearchOpen"; open: boolean }
  | { type: "setPaletteOpen"; open: boolean }
  | { type: "setPaletteQuery"; query: string }
  | { type: "setPaletteIndex"; index: number }
  | { type: "setNodeColorOpen"; open: boolean }
  | { type: "setNodeMemoOpen"; open: boolean }
  | { type: "setSettingsOpen"; open: boolean }
  | { type: "dispatch"; action: EditorAction }
  | { type: "selectNode"; nodeId: NodeId }
  | { type: "setCursorColor"; color: NodeColor | null }
  | { type: "setJumpPrefix"; prefix: string }
  | { type: "openJump" }
  | { type: "openRelatedLinkJump" }
  | { type: "closeJump" }
  | { type: "nudgeSelection"; dx: number; dy: number }
  | { type: "multi"; commands: KeyboardCommand[] };

export type KeyboardResolution = {
  command: KeyboardCommand;
  preventDefault: boolean;
};
