import { useEffect } from "react";
import { createPortal } from "react-dom";

import styles from "./canvas-gui.module.css";
import SideTools from "./side-tools";
import { useEditorState } from "./state/editor-state-context";
import EditorStateProvider from "./state/editor-state-provider";
import TopTools from "./top-tools/index";
import CanvasWorkspace from "./workspace";

function CanvasGuiContent() {
  const { state } = useEditorState();

  useEffect(() => {
    if (!state.isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [state.isFullscreen]);

  return (
    <>
      <section id="visual-editor" className={styles.root} aria-label="Canvas GUI">
        <div className={styles.workspace} aria-label="Canvas workspace">
          {!state.isFullscreen && (
            <>
              <div className={styles.topRow}>
                <div className={styles.heading}>
                  <h3>Visual Editor</h3>
                </div>
                <TopTools />
              </div>

              <div className={styles.lowerRow}>
                <SideTools />
                <CanvasWorkspace />
              </div>
            </>
          )}
        </div>
      </section>

      {state.isFullscreen && createPortal(
        <section className={styles.fullscreen} aria-label="Fullscreen canvas workspace">
          <CanvasWorkspace fullscreen />
          <TopTools floating hidden={state.toolingCollapsed} />
          <SideTools floating />
        </section>,
        document.body
      )}
    </>
  );
}

export default function CanvasGui() {
  return (
    <EditorStateProvider>
      <CanvasGuiContent />
    </EditorStateProvider>
  );
}
