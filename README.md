# vikokoro

Japanese version: [README.ja.md](README.ja.md)

A keyboard-first tree/mind-map style editor built with Tauri v2 + React + TypeScript.
You can add, move, and edit nodes using Vim-like **Normal / Insert** modes.

<img src="./out2.gif" alt="vikokoro demo" width="840" />

This demo shows the basic flow: add nodes (`Tab` / `Enter`) -> edit (Insert) -> move (`hjkl` + `J/K`).

Note: This is currently a personal project, so specs and behavior may change.


## Features

- Edit with Normal / Insert mode switching
- `Tab` adds a child node, `Enter` adds a sibling node (both start editing immediately)
- Move the cursor with `h/j/k/l`, reorder siblings with `J/K`
- Move node hierarchy with `H/L` (left/right = outdent/indent, subtree included)
- Delete with `dd` (root is protected, children are promoted)
- Node colors (`c` to open, `1-5` to apply, `0` to clear; `5` = gray for done/history)
- Undo / Redo
- Tabs (multiple documents)
- Search (`Ctrl+F`) / Command palette (`Ctrl+P`) / Help (`?`)
- Theme switcher (Dark / Light / Ivory / Tokyo Night)
- Zoom (`Ctrl + Wheel`) / Pan (`Space + Drag`)
- Local persistence (Tauri runtime only)


## Usage

The in-app help is the most up-to-date shortcut reference.

- Help: `?`
- Close: `Esc`

Common keys (Normal mode):

- `Tab`: Add a child and start editing
- `Enter`: Add a sibling and start editing
- `h/j/k/l`: Move to parent/next/previous/child
- `J/K`: Reorder sibling down/up
- `H/L`: Move node left/right in hierarchy (outdent / indent)
- `dd`: Delete
- `c`: Open node color menu (`1-5` apply, `0` clear, `Esc` close)
- `u` / `Ctrl+r`: Undo / Redo

Editing (Insert mode):

- `i`: Enter Insert mode
- `Esc`: Confirm and return to Normal mode
- `Enter`: Confirm
  - When using Japanese IME conversion, confirmation can behave like a two-step Enter because of composition handling.
    (With direct alphanumeric input, one Enter is typically enough.)


## Data Persistence

When running in Tauri (`npm run tauri dev` / `npm run tauri build`), the workspace is stored locally.

- Save location: `workspace.json` under OS-specific AppData
  - Uses `BaseDirectory::AppData` on the Tauri side
- In browser mode (`npm run dev`), `invoke` is unavailable, so persistence is disabled (UI shows `Local`)


## Setup (for Developers)

### Requirements

- Node.js (because of Vite requirements, **20.19+ or 22.12+ is recommended**)
- Rust (stable)

VS Code + rust-analyzer + Tauri extension is a convenient setup.

### Install

```sh
npm ci
```

### Run

Run in browser (no persistence):

```sh
npm run dev
```

Run in Tauri (with persistence):

```sh
npm run tauri dev
```

### Build

```sh
npm run tauri build
```

Build artifacts are generally generated under `src-tauri/target/release/bundle/`.


## GitHub Actions (macOS/Windows build)

For machines without a local build environment, you can generate executables with GitHub Actions.

- Workflow: `.github/workflows/tauri-build.yml`
- How to run: GitHub `Actions` tab -> `tauri-build` -> `Run workflow`
- Artifacts: `vikokoro-macos-latest` / `vikokoro-windows-latest`


## Troubleshooting

### macOS shows "App is damaged and can't be opened"

When downloading an unsigned app, Gatekeeper (quarantine attribute) may block it.
If you only need to run it on your own machine, this may help:

```sh
xattr -dr com.apple.quarantine "/Applications/vikokoro.app"
```

Optional status check:

```sh
spctl --assess --verbose=4 "/Applications/vikokoro.app"
```

### Node.js version warning appears

Because of Vite requirements, older Node.js versions can show warnings.
Check `node -v` and upgrade to `22.12+` or `20.19+` if needed.


## Main Directories

- `src/`: Frontend (React/TS)
- `src/editor/`: Core editor (state, layout, view)
- `src/hooks/`: Hooks including persistence
- `src/ui/modals/`: Modals such as Help/Search/Palette
- `src-tauri/`: Tauri (Rust) side
- `docs/`: Milestones and handover notes

## Contributing

Please read the contribution guide before opening Issues or PRs:
[`CONTRIBUTING.md`](CONTRIBUTING.md)


## License

MIT (`LICENSE`)
