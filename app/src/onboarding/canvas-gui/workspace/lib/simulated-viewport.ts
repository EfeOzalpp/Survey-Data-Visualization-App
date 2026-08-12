import type { DeviceType } from "../../../../scene-canvas/shared/responsiveness";
import type { DeviceKey } from "../../state/editor-state-context";

interface SimulatedViewport {
  ruleDevice: DeviceType;
  ruleWidthPx: number;
}

const SIMULATED_VIEWPORTS: Record<DeviceKey, SimulatedViewport> = {
  mobile: {
    ruleDevice: "mobile",
    ruleWidthPx: 390,
  },
  tablet: {
    ruleDevice: "tablet",
    ruleWidthPx: 768,
  },
  desktop: {
    ruleDevice: "laptop",
    ruleWidthPx: 1440,
  },
};

export function resolveSimulatedViewport(device: DeviceKey) {
  return SIMULATED_VIEWPORTS[device];
}
