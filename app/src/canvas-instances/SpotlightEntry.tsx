import { EngineHost } from "../scene-canvas/EngineHost";
import type { SpotlightSignal } from "../scene-canvas/hooks/signals";

export default function SpotlightEntry({
  visible = true,
  spotlight,
  liveAvg = 0.5,
  className,
}: {
  visible?: boolean;
  spotlight?: SpotlightSignal;
  liveAvg?: number;
  className?: string;
}) {
  return (
    <>
      <div id="spotlight-canvas-root" className={className} />
      <EngineHost
        id="spotlight"
        open
        visible={visible}
        liveAvg={liveAvg}
        spotlight={spotlight}
        fog={false}
        shapeLightSource={{ xK: 0.4, yK: 0.1, paletteClosenessK: 0.9 }}
      />
    </>
  );
}
