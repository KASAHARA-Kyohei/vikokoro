# vikokoro Current Spec

## Product

vikokoro is a local-first mind map with Vim-style editing and navigation. Nodes keep explicit parent-child relationships while remaining freely movable.

## Domain model

- `Document`: nodes, links, sticky notes, viewport, selection, and history.
- `Node`: identity, text, optional memo/color, parent/children, position, and natural size.
- `Viewport`: persisted scroll origin and zoom.
- `Selection`: selected nodes and the last edited node.
- `History`: per-document snapshots used by Undo/Redo.
- `DocumentRepository`: asynchronous load/save boundary implemented with Tauri commands.
- `ThoughtOrganizer`: asynchronous suggestion boundary. The current implementation is a non-destructive mock preview.

Persisted workspaces use `schemaVersion: 2`. Legacy documents are hydrated with derived node sizes, the former cursor as selection, and a default viewport.

## Interaction

- Tab/Enter create child/sibling nodes and enter inline editing.
- Enter commits, Shift+Enter inserts a newline, and Escape restores the edit origin. Japanese IME composition Enter is not treated as commit.
- `h/j/k/l` navigates the hierarchy. `Shift+j/k` exchanges adjacent sibling branches visually and logically.
- Blank double-click creates at the pointer; Command+Enter creates at viewport center.
- Shift or Command click toggles nodes; blank drag performs marquee selection. Dragging a selected node moves the selection in one history step.
- Command+D duplicates selected nodes with a small offset.
- Space+left drag or middle-button drag pans. Modified wheel and toolbar controls zoom from 0.5 to 2.
- Parent-child connectors, folding, focus, explicit related links, and sticky notes are available in the single map view.

## History and persistence

- Node creation, deletion, duplication, text edits, moves, and sibling branch exchanges are undoable.
- Selection and viewport are persisted but are not Undo targets.
- Tauri stores the complete JSON value at AppData `workspace.json`. Writes use a temporary file and rename; malformed JSON is moved to a timestamped backup.
- Browser-only Vite mode reports local persistence as unavailable.

## AI direction

No external AI API is called. Selecting nodes and requesting organization produces an in-memory mock preview without mutating source data. Applying suggestions will be designed alongside a future AI integration.

## Verification

- Frontend: `npm run lint`, `npm run typecheck`, `npm run test:offline`, `npm run build`.
- Tauri: `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo check --manifest-path src-tauri/Cargo.toml`.
