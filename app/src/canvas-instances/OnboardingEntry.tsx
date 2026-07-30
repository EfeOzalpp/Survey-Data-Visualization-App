// src/canvas-instances/OnboardingEntry.tsx

import { memo } from "react";
import { useCanvasRuntimeStore } from "../app/state/canvas-runtime-store";
import { EngineHost } from "../scene-canvas/EngineHost";
import { recordOwnRender } from "../render-test/renderProfilerStats";

function CanvasEntry({ visible = true }: { visible?: boolean }) {
  recordOwnRender("CanvasEntry");
  const liveAvg = useCanvasRuntimeStore((s) => s.liveAvg);
  const reservedFootprints = useCanvasRuntimeStore((s) => s.reservedFootprints);

  return (
    <div
      className="onboarding-canvas"
      role="img"
      aria-label="Animated sustainability visualization"
    >
      <div id="canvas-root" style={{ width: "100%", height: "100%" }} />
      <EngineHost
        id="start"
        open
        visible={visible}
        liveAvg={liveAvg}
        reservedFootprints={reservedFootprints}
      />
    </div>
  );
}

export default memo(CanvasEntry);
