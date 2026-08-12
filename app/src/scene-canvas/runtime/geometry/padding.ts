// src/scene-canvas/runtime/geometry/padding.ts

import { CANVAS_PADDING } from "../../scene-rules/canvas-padding/index";
import type { CanvasPaddingSpec } from "../../scene-rules/canvas-padding/index";
import type { SceneLookupKey } from "../../scene-rules/lookup";
import { resolvePaddingSpec } from "../../scene-rules/canvas-padding";

/**
 * Runtime padding policy.
 * - If override is set, use it.
 * - Otherwise resolve from CANVAS_PADDING for current lookup key.
 *
 * NOTE: CANVAS_PADDING entries can contain `null` for a device, and
 * resolvePaddingSpec should implement fallback behavior.
 */
export function getPaddingSpecForState(
  widthPx: number,
  sceneLookupKey: SceneLookupKey,
  override: CanvasPaddingSpec | null
): CanvasPaddingSpec {
  if (override) return override;

  const byDevice = CANVAS_PADDING[sceneLookupKey];
  return resolvePaddingSpec(widthPx, byDevice);
}
