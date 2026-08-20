# vikokoro Current Spec

## Product

vikokoro is a local-first mind map with Vim-style editing and navigation. Nodes keep explicit parent-child relationships while remaining freely movable.

## Domain model

- `Document`: nodes, branch directions, links, sticky notes, viewport, selection, and history.
- `Node`: identity, text, optional memo/manual color/first-level branch tone, parent/children, position, and natural size.
- `Viewport`: persisted scroll origin and zoom.
- `Selection`: selected nodes and the last edited node.
- `History`: per-document snapshots used by Undo/Redo.
- `DocumentRepository`: asynchronous load/save boundary implemented with Tauri commands.
- `ThoughtOrganizer`: asynchronous suggestion boundary. The current implementation is a non-destructive mock preview.

Persisted workspaces use `schemaVersion: 3`. Each non-root node stores an eight-way `branchDirection`; each first-level node stores a persistent `branchTone`. Version 2 and older workspaces infer directions from current node centers while preserving coordinates and saved viewports.

## Interaction

- In Normal mode, `a` opens an eight-way radial picker around the selected node. `q/w/e/a/d/z/x/c` choose northwest/north/northeast/west/east/southwest/south/southeast; click and Escape are supported.
- Tab creates a child using the latest direct-child direction, then the current node's incoming direction, then east. Enter creates a sibling in the current node's direction. Both enter inline editing.
- Enter commits, Shift+Enter inserts a newline, and Escape restores the edit origin. Japanese IME composition Enter is not treated as commit.
- `h/j/k/l` moves to the nearest visible node on screen left/down/up/right. Candidates use node rectangles, prefer perpendicular-axis overlap, and never wrap around. `←/↓/↑/→` retain hierarchy navigation (parent/next sibling/previous sibling/child); in focus mode `←` returns to the focus parent. `Shift+j/k` exchanges adjacent sibling branches visually and logically.
- Blank double-click creates at the pointer; Command+Enter creates at viewport center.
- Shift or Command click toggles nodes; blank drag performs marquee selection. Dragging a selected node moves the selection in one history step. If its parent is not moved, the new center angle is rounded to the nearest 45 degrees and saved in the same history step.
- Command+D duplicates selected nodes with a small offset.
- Space+left drag or middle-button drag pans. Modified wheel and toolbar controls zoom from 0.5 to 2.
- Parent-child connectors use automatic perimeter intersections and organic curves. Manual four-side anchors still override automatic endpoints.
- The root is visually emphasized. Descendants use pill-shaped nodes and inherit one of eight branch colors from their first-level ancestor; a manual node color remains the fill override.
- Explicit branch auto-layout keeps the branch root fixed. Whole-map auto-layout keeps the document root fixed, fans siblings along each direction's tangent, and pushes colliding branches outward. Existing maps are never automatically rearranged during migration.
- An unsaved viewport starts with the root centered; a saved viewport is restored unchanged.
- Folding, focus, explicit related links, and sticky notes are available in the single map view.

## History and persistence

- Node creation, deletion, duplication, text edits, moves, direction changes, parent changes, and sibling branch exchanges are undoable.
- Selection and viewport are persisted but are not Undo targets.
- Tauri stores the complete JSON value at AppData `workspace.json`. Writes use a temporary file and rename; malformed JSON is moved to a timestamped backup.
- Browser-only Vite mode reports local persistence as unavailable.

## AI direction

No external AI API is called. Selecting nodes and requesting organization produces an in-memory mock preview without mutating source data. Applying suggestions will be designed alongside a future AI integration.

## Verification

- Frontend: `npm run lint`, `npm run typecheck`, `npm run test:offline`, `npm run build`.
- Tauri: `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo check --manifest-path src-tauri/Cargo.toml`.
