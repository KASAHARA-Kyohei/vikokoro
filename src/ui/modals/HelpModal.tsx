type Props = {
  open: boolean;
  onClose: () => void;
};

export function HelpModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="modalOverlay"
      onMouseDown={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="modal helpModal"
        onMouseDown={(e) => {
          e.preventDefault();
        }}
      >
        <div className="modalTitle">Help</div>
        <div className="modalBody">
          <div className="helpGrid">
            <div className="helpRow">
              <div className="helpKeys">
                <kbd>Tab</kbd>
              </div>
              <div className="helpDesc">Add child (and edit)</div>
            </div>
            <div className="helpRow">
              <div className="helpKeys">
                <kbd>Enter</kbd>
              </div>
              <div className="helpDesc">Add sibling (and edit)</div>
            </div>
            <div className="helpRow">
              <div className="helpKeys">
                <kbd>i</kbd> / <kbd>Enter</kbd> / <kbd>Esc</kbd>
              </div>
              <div className="helpDesc">Insert / Commit / Exit to Normal</div>
            </div>
            <div className="helpRow">
              <div className="helpKeys">
                <kbd>h</kbd>
                <kbd>j</kbd>
                <kbd>k</kbd>
                <kbd>l</kbd>
              </div>
              <div className="helpDesc">Move (parent / next / prev / child)</div>
            </div>
            <div className="helpRow">
              <div className="helpKeys">
                <kbd>J</kbd> / <kbd>K</kbd>
              </div>
              <div className="helpDesc">Swap siblings (down / up)</div>
            </div>
            <div className="helpRow">
              <div className="helpKeys">
                <kbd>H</kbd> / <kbd>L</kbd>
              </div>
              <div className="helpDesc">Move node left/right (outdent / indent)</div>
            </div>
            <div className="helpRow">
              <div className="helpKeys">
                <kbd>f</kbd> + hint key(s)
              </div>
              <div className="helpDesc">Jump to any node (nearest nodes get easier hints)</div>
            </div>
            <div className="helpRow">
              <div className="helpKeys">
                <kbd>dd</kbd>
              </div>
              <div className="helpDesc">Delete (root is protected)</div>
            </div>
            <div className="helpRow">
              <div className="helpKeys">
                <kbd>c</kbd>
              </div>
              <div className="helpDesc">Node color menu (1-5 apply / 0 clear)</div>
            </div>
            <div className="helpRow">
              <div className="helpKeys">
                <kbd>u</kbd> / <kbd>Ctrl</kbd>+<kbd>r</kbd>
              </div>
              <div className="helpDesc">Undo / Redo</div>
            </div>
            <div className="helpRow">
              <div className="helpKeys">
                <kbd>Ctrl</kbd>+<kbd>T</kbd> / <kbd>Ctrl</kbd>+<kbd>W</kbd>
              </div>
              <div className="helpDesc">New tab / Close tab</div>
            </div>
            <div className="helpRow">
              <div className="helpKeys">
                <kbd>Ctrl</kbd>+<kbd>Tab</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Tab</kbd>
              </div>
              <div className="helpDesc">Switch tab (next / prev)</div>
            </div>
            <div className="helpRow">
              <div className="helpKeys">
                <kbd>Ctrl</kbd>+<kbd>F</kbd>
              </div>
              <div className="helpDesc">Search</div>
            </div>
            <div className="helpRow">
              <div className="helpKeys">
                <kbd>Ctrl</kbd>+<kbd>P</kbd>
              </div>
              <div className="helpDesc">Command palette</div>
            </div>
            <div className="helpRow">
              <div className="helpKeys">
                <kbd>Ctrl</kbd> + <kbd>Wheel</kbd>
              </div>
              <div className="helpDesc">Zoom (around mouse)</div>
            </div>
            <div className="helpRow">
              <div className="helpKeys">
                <kbd>Space</kbd> + Drag
              </div>
              <div className="helpDesc">Pan (grab to move)</div>
            </div>
            <div className="helpRow">
              <div className="helpKeys">
                <kbd>?</kbd>
              </div>
              <div className="helpDesc">Open help</div>
            </div>
            <div className="helpRow">
              <div className="helpKeys">Theme</div>
              <div className="helpDesc">Cycle on the top right (Dark/Light/Ivory/Tokyo Night)</div>
            </div>
          </div>
        </div>

        <div className="modalActions">
          <button
            type="button"
            className="modalButton"
            onMouseDown={(e) => {
              e.preventDefault();
              onClose();
            }}
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
