import type { NodeColor } from "../../editor/types";
import { resolveJumpKey } from "../../features/jump/model";
import type { KeyboardInput, KeyboardResolution, KeyboardResolverContext } from "./types";

const COLOR_SHORTCUTS: Record<string, NodeColor> = {
  "1": "blue",
  "2": "green",
  "3": "yellow",
  "4": "pink",
  "5": "gray",
};

export function resolveKeyboardCommand(
  ctx: KeyboardResolverContext,
  input: KeyboardInput,
): KeyboardResolution {
  const { key, ctrlKey, metaKey, altKey, shiftKey } = input;

  if (ctx.helpOpen) {
    if (key === "Escape") {
      return { preventDefault: true, command: { type: "setHelpOpen", open: false } };
    }
    return { preventDefault: true, command: { type: "preventOnly" } };
  }

  if (ctx.searchOpen) {
    if (key === "Escape") {
      return { preventDefault: true, command: { type: "setSearchOpen", open: false } };
    }
    if (ctrlKey && (key === "w" || key === "t" || key === "Tab")) {
      return { preventDefault: true, command: { type: "preventOnly" } };
    }
    return { preventDefault: false, command: { type: "none" } };
  }

  if (ctx.paletteOpen) {
    if (key === "Escape") {
      return { preventDefault: true, command: { type: "setPaletteOpen", open: false } };
    }
    if (ctrlKey && (key === "w" || key === "t" || key === "Tab")) {
      return { preventDefault: true, command: { type: "preventOnly" } };
    }
    return { preventDefault: false, command: { type: "none" } };
  }

  if (ctx.nodeColorOpen) {
    if (key === "Escape") {
      return { preventDefault: true, command: { type: "setNodeColorOpen", open: false } };
    }
    if (key === "0") {
      return {
        preventDefault: true,
        command: {
          type: "multi",
          commands: [
            { type: "setCursorColor", color: null },
            { type: "setNodeColorOpen", open: false },
          ],
        },
      };
    }
    const color = COLOR_SHORTCUTS[key];
    if (color) {
      return {
        preventDefault: true,
        command: {
          type: "multi",
          commands: [
            { type: "setCursorColor", color },
            { type: "setNodeColorOpen", open: false },
          ],
        },
      };
    }
    return { preventDefault: true, command: { type: "preventOnly" } };
  }

  if (ctx.closeConfirmOpen) {
    if (key === "y" || key === "Y") {
      return { preventDefault: true, command: { type: "dispatch", action: { type: "closeActiveDoc" } } };
    }
    if (key === "n" || key === "N" || key === "Escape") {
      return {
        preventDefault: true,
        command: { type: "dispatch", action: { type: "cancelCloseConfirm" } },
      };
    }
    return { preventDefault: true, command: { type: "preventOnly" } };
  }

  if (ctx.jumpSession) {
    const resolution = resolveJumpKey({
      session: ctx.jumpSession,
      prefix: ctx.jumpPrefix,
      key,
      ctrlKey,
      metaKey,
      altKey,
    });

    if (resolution.type === "keep") {
      return { preventDefault: true, command: { type: "preventOnly" } };
    }
    if (resolution.type === "cancel") {
      return { preventDefault: true, command: { type: "closeJump" } };
    }
    if (resolution.type === "setPrefix") {
      return {
        preventDefault: true,
        command: { type: "setJumpPrefix", prefix: resolution.prefix },
      };
    }
    return {
      preventDefault: true,
      command: {
        type: "multi",
        commands: [{ type: "closeJump" }, { type: "selectNode", nodeId: resolution.nodeId }],
      },
    };
  }

  if (ctx.mode === "normal" && (key === "?" || (key === "/" && shiftKey))) {
    return { preventDefault: true, command: { type: "setHelpOpen", open: true } };
  }

  if (ctx.mode === "normal" && ctrlKey && (key === "f" || key === "F")) {
    return {
      preventDefault: true,
      command: {
        type: "multi",
        commands: [
          { type: "setSearchOpen", open: true },
          { type: "setPaletteOpen", open: false },
        ],
      },
    };
  }

  if (ctx.mode === "normal" && ctrlKey && (key === "p" || key === "P")) {
    return {
      preventDefault: true,
      command: {
        type: "multi",
        commands: [
          { type: "setPaletteQuery", query: "" },
          { type: "setPaletteIndex", index: 0 },
          { type: "setPaletteOpen", open: true },
          { type: "setSearchOpen", open: false },
        ],
      },
    };
  }

  if (ctx.mode === "insert") {
    if (key === "Escape") {
      return { preventDefault: true, command: { type: "dispatch", action: { type: "commitInsert" } } };
    }
    if (key === "Tab" || (ctrlKey && key === "Tab")) {
      return { preventDefault: true, command: { type: "preventOnly" } };
    }
    if (ctrlKey && (key === "t" || key === "w")) {
      return { preventDefault: true, command: { type: "preventOnly" } };
    }
    return { preventDefault: false, command: { type: "none" } };
  }

  if (!ctrlKey && !metaKey && !altKey && key.toLowerCase() === "f") {
    return { preventDefault: true, command: { type: "openJump" } };
  }

  if (!ctrlKey && !metaKey && !altKey && key === "c") {
    return { preventDefault: true, command: { type: "setNodeColorOpen", open: true } };
  }

  if (ctrlKey && (key === "t" || key === "T")) {
    return { preventDefault: true, command: { type: "dispatch", action: { type: "createDoc" } } };
  }

  if (ctrlKey && (key === "w" || key === "W")) {
    return {
      preventDefault: true,
      command: { type: "dispatch", action: { type: "requestCloseActiveDoc" } },
    };
  }

  if (ctrlKey && key === "Tab") {
    return {
      preventDefault: true,
      command: {
        type: "dispatch",
        action: { type: shiftKey ? "switchDocPrev" : "switchDocNext" },
      },
    };
  }

  if (key === "Tab") {
    return {
      preventDefault: true,
      command: { type: "dispatch", action: { type: "addChildAndInsert" } },
    };
  }

  if (key === "Enter") {
    return {
      preventDefault: true,
      command: { type: "dispatch", action: { type: "addSiblingAndInsert" } },
    };
  }

  if (key === "Escape") {
    return { preventDefault: true, command: { type: "dispatch", action: { type: "commitInsert" } } };
  }

  if (key === "i") {
    return { preventDefault: true, command: { type: "dispatch", action: { type: "enterInsert" } } };
  }

  if (key === "h") {
    return {
      preventDefault: true,
      command: { type: "dispatch", action: { type: "moveCursor", direction: "parent" } },
    };
  }

  if (key === "l") {
    return {
      preventDefault: true,
      command: { type: "dispatch", action: { type: "moveCursor", direction: "child" } },
    };
  }

  if (key === "j") {
    return {
      preventDefault: true,
      command: { type: "dispatch", action: { type: "moveCursor", direction: "nextSibling" } },
    };
  }

  if (key === "k") {
    return {
      preventDefault: true,
      command: { type: "dispatch", action: { type: "moveCursor", direction: "prevSibling" } },
    };
  }

  if (key === "J") {
    return {
      preventDefault: true,
      command: { type: "dispatch", action: { type: "swapSibling", direction: "down" } },
    };
  }

  if (key === "K") {
    return {
      preventDefault: true,
      command: { type: "dispatch", action: { type: "swapSibling", direction: "up" } },
    };
  }

  if (key === "H") {
    return {
      preventDefault: true,
      command: { type: "dispatch", action: { type: "reparentNode", direction: "left" } },
    };
  }

  if (key === "L") {
    return {
      preventDefault: true,
      command: { type: "dispatch", action: { type: "reparentNode", direction: "right" } },
    };
  }

  if (key === "u") {
    return { preventDefault: true, command: { type: "dispatch", action: { type: "undo" } } };
  }

  if (ctrlKey && key === "r") {
    return { preventDefault: true, command: { type: "dispatch", action: { type: "redo" } } };
  }

  return { preventDefault: false, command: { type: "none" } };
}
