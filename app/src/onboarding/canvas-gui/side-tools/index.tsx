import { useRef } from "react";

import floatingStyles from "../shared/floating-tools.module.css";
import { HoverHintProvider } from "../shared/hover-hint";
import { useEditorState } from "../state/editor-state-context";
import Fullscreen from "./fullscreen/index";
import Grid from "./grid/index";
import HideTooling from "./hide-tooling/index";
import Orient from "./orient/index";
import Reset from "./reset/index";
import styles from "./side-tools.module.css";

export default function SideTools({ floating = false }: { floating?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { state } = useEditorState();
  const collapsed = floating && state.toolingCollapsed;
  const className = [
    styles.root,
    floating ? styles.floating : "",
    floating ? floatingStyles.island : "",
    collapsed ? styles.collapsed : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      ref={rootRef}
      className={className}
      role="toolbar"
      aria-label="Canvas tools"
      aria-orientation="vertical"
    >
      <HoverHintProvider containerRef={rootRef} placement="right">
        <div className={styles.group}>
          <div className={styles.stack}>
            <div className={styles.collapsibleTool}>
              <Fullscreen />
            </div>
            {floating && <HideTooling />}
          </div>
        </div>
        <div className={`${styles.group} ${styles.collapsibleGroup}`}>
          <Orient />
        </div>
        <div className={`${styles.group} ${styles.collapsibleGroup}`}>
          <Grid />
        </div>
        <div className={`${styles.group} ${styles.collapsibleGroup}`}>
          <Reset />
        </div>
      </HoverHintProvider>
    </div>
  );
}
