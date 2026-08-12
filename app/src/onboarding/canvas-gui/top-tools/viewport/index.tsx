import { useState } from "react";

import { useEditorState, type DeviceKey } from "../../state/editor-state-context";
import shared from "../top-tools.module.css";
import Device from "./device";
import Rows from "./rows";
import styles from "./viewport.module.css";

type PanelKey = "device" | "rows";

export default function Viewport() {
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);
  const { state, dispatch } = useEditorState();

  const getPanelProps = (panel: PanelKey) => ({
    open: openPanel === panel,
    onOpenChange: (shouldOpen: boolean) => {
      setOpenPanel((currentPanel) => {
        if (shouldOpen) return panel;
        return currentPanel === panel ? null : currentPanel;
      });
    },
  });

  return (
    <div className={`${shared.group} ${shared.fullDivider} ${styles.group}`}>
      <div className={styles.item}>
        <span className={shared.label}>Device</span>
        <Device
          {...getPanelProps("device")}
          activeDevice={state.activeDevice}
          onDeviceChange={(device: DeviceKey) => {
            dispatch({ type: "set-device", device });
          }}
        />
      </div>
      <div className={styles.item}>
        <span className={shared.label}>Rows</span>
        <Rows
          {...getPanelProps("rows")}
          device={state.activeDevice}
        />
      </div>
    </div>
  );
}
