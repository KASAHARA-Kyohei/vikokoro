# vikokoro

日本語: [README.ja.md](README.ja.md)

vikokoro is a local-first mind map for quickly writing, navigating, and arranging ideas with Vim-style controls. It is built with Tauri v2, React, and TypeScript.

## Highlights

- Eight-direction branches from any node: press `a`, then choose `q/w/e/a/d/z/x/c`
- Organic curved connectors and an inherited eight-color palette for first-level branches
- Free-position cards on a large pannable and zoomable canvas
- Create by blank-area double-click or `Cmd+Enter`, then type immediately
- IME-safe inline editing: Enter commits, Shift+Enter adds a line, Escape cancels
- Shift/Command multi-selection, marquee selection, and batch movement
- Duplicate with `Cmd+D`
- Parent-child links, folding, focus mode, and Vim-style navigation
- Explicit auto-layout fans siblings around their branch while keeping the layout root fixed
- Undo/redo and atomic JSON persistence in Tauri AppData
- A replaceable `ThoughtOrganizer` interface with non-destructive mock previews

There is no direct external AI API connection. The current boundary is intended to evolve first into a browser prompt workflow and later into agent-proposed edits.

`Tab` follows the latest child direction, then the selected node's incoming direction, and finally east. `Enter` creates a sibling in the current direction. Dragging a node freely updates its direction to the nearest 45-degree angle; moving a parent and child together preserves the child's direction.

In Normal mode, `h/j/k/l` moves to the nearest visible node on screen left/down/up/right, including nodes outside the current viewport. Arrow keys keep hierarchy navigation: `←/↓/↑/→` move to the parent/next sibling/previous sibling/child. Shift+HJKL and Alt+HJKL keep their existing editing and nudge actions.

## Development

```sh
npm ci
npm run dev
```

Run checks with `npm run lint`, `npm run typecheck`, `npm run test:offline`, `npm run build`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `cargo check --manifest-path src-tauri/Cargo.toml`.
