import { useRef } from "react";

import Assets from "./assets/index";
import Brush from "./drawing/brush/index";
import Eraser from "./drawing/eraser/index";
import Presets from "./presets/index";
import floatingStyles from "../shared/floating-tools.module.css";
import { HoverHintProvider } from "../shared/hover-hint";
import styles from "./top-tools.module.css";
import View from "./view/index";
import Viewport from "./viewport/index";

export default function TopTools({
  floating = false,
  hidden = false,
}: {
  floating?: boolean;
  hidden?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const className = [
    styles.root,
    floating ? styles.floating : "",
    floating ? floatingStyles.island : "",
    hidden ? styles.hidden : "",
  ].filter(Boolean).join(" ");

  return (
    <div ref={rootRef} className={className} role="group" aria-label="Editor tools">
      <HoverHintProvider containerRef={rootRef} placement="bottom">
        <View floating={floating} />
        <Viewport />
        <Presets />
        <Brush />
        <Eraser />
        <Assets />
      </HoverHintProvider>
    </div>
  );
}
