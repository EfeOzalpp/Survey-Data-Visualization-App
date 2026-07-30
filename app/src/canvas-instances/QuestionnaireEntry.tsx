// src/canvas-instances/QuestionnaireEntry.tsx

import { memo } from "react";
import { useCanvasRuntimeStore } from "../app/state/canvas-runtime-store";
import { EngineHost } from "../scene-canvas/EngineHost";
import { recordOwnRender } from "../render-test/renderProfilerStats";

function QuestionnaireEntry({ visible = true }: { visible?: boolean }) {
  recordOwnRender("QuestionnaireEntry");
  const liveAvg = useCanvasRuntimeStore((s) => s.liveAvg);
  const reservedFootprints = useCanvasRuntimeStore((s) => s.reservedFootprints);

  return (
    <div
      className="onboarding-canvas questionnaire-active"
      role="img"
      aria-label="Animated sustainability questionnaire visualization"
    >
      <div id="questionnaire-canvas-root" style={{ width: "100%", height: "100%" }} />
      <EngineHost
        id="questionnaire"
        open
        visible={visible}
        liveAvg={liveAvg}
        reservedFootprints={reservedFootprints}
      />
    </div>
  );
}

export default memo(QuestionnaireEntry);
