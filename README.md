# vikokoro

日本語: [README.ja.md](README.ja.md)

vikokoro is a local-first mind map for quickly writing, navigating, and arranging ideas with Vim-style controls. It is built with Tauri v2, React, and TypeScript.

## Highlights

- Free-position cards on a large pannable and zoomable canvas
- Create by blank-area double-click or `Cmd+Enter`, then type immediately
- IME-safe inline editing: Enter commits, Shift+Enter adds a line, Escape cancels
- Shift/Command multi-selection, marquee selection, and batch movement
- Duplicate with `Cmd+D`
- Parent-child links, folding, focus mode, and Vim-style navigation
- Undo/redo and atomic JSON persistence in Tauri AppData
- A replaceable `ThoughtOrganizer` interface with non-destructive mock previews

There is no direct external AI API connection. The current boundary is intended to evolve first into a browser prompt workflow and later into agent-proposed edits.

## Development

```sh
npm ci
npm run dev
```

Run checks with `npm run lint`, `npm run typecheck`, `npm run test:offline`, `npm run build`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `cargo check --manifest-path src-tauri/Cargo.toml`.
