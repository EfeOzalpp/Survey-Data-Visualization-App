import { useRef } from "react";

import floatingStyles from "../shared/floating-tools.module.css";
import { HoverHintProvider } from "../shared/hover-hint";
import Fullscreen from "./fullscreen/index";
import Grid from "./grid/index";
import Orient from "./orient/index";
import Reset from "./reset/index";
import styles from "./side-tools.module.css";

export default function SideTools({ floating = false }: { floating?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const className = [
    styles.root,
    floating ? styles.floating : "",
    floating ? floatingStyles.island : "",
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
          <Fullscreen />
        </div>
        <div className={styles.group}>
          <Orient />
        </div>
        <div className={styles.group}>
          <Grid />
        </div>
        <div className={styles.group}>
          <Reset />
        </div>
      </HoverHintProvider>
    </div>
  );
}
