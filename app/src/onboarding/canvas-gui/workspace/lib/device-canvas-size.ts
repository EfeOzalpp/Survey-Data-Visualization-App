import type { DeviceKey } from "../../state/editor-state-context";

interface DeviceCanvasConfig {
  widthScale: number;
  fullscreenWidthScale?: number;
  aspectRatio: number;
}

export interface DeviceCanvasSize {
  width: number;
  height: number;
}

const DEVICE_CANVAS_CONFIG: Record<DeviceKey, DeviceCanvasConfig> = {
  desktop: {
    widthScale: 0.85,
    fullscreenWidthScale: 0.70,
    aspectRatio: 16 / 9,
  },
  tablet: {
    widthScale: 0.35,
    fullscreenWidthScale: 0.3,
    aspectRatio: 3 / 4,
  },
  mobile: {
    widthScale: 0.3,
    fullscreenWidthScale: 0.25,
    aspectRatio: 12 / 19.5,
  },
};

export function resolveDeviceCanvasSize(
  device: DeviceKey,
  viewportWidth: number,
  fullscreen: boolean
): DeviceCanvasSize {
  const config = DEVICE_CANVAS_CONFIG[device];
  const widthScale = fullscreen
    ? config.fullscreenWidthScale ?? config.widthScale
    : config.widthScale;
  const width = Math.max(1, Math.round(viewportWidth * widthScale));

  return {
    width,
    height: Math.max(1, Math.round(width / config.aspectRatio)),
  };
}
