import brushCursorSvg from "../../../../assets/svg/gui/brush/brush.svg?raw";
import eraserCursorSvg from "../../../../assets/svg/gui/erase/erase.svg?raw";
import moveCursorSvg from "../../../../assets/svg/gui/move/move.svg?raw";
import selectCursorSvg from "../../../../assets/svg/gui/select/select.svg?raw";
import type { EditorTool } from "../../state/editor-state-context";

interface ToolCursor {
  fallback: string;
  hotspotX: number;
  hotspotY: number;
  svg: string;
}

const TOOL_CURSORS: Record<EditorTool, ToolCursor> = {
  move: {
    svg: moveCursorSvg,
    hotspotX: 8,
    hotspotY: 3,
    fallback: "grab",
  },
  select: {
    svg: selectCursorSvg,
    hotspotX: 7,
    hotspotY: 4,
    fallback: "default",
  },
  brush: {
    svg: brushCursorSvg,
    hotspotX: 6,
    hotspotY: 18,
    fallback: "crosshair",
  },
  eraser: {
    svg: eraserCursorSvg,
    hotspotX: 6,
    hotspotY: 17,
    fallback: "cell",
  },
};

const CURSOR_URL_CACHE = new Map<string, string>();

function themedCursorUrl(tool: EditorTool, textColor: string) {
  const cacheKey = `${tool}:${textColor}`;
  const cached = CURSOR_URL_CACHE.get(cacheKey);
  if (cached) return cached;

  const svg = TOOL_CURSORS[tool].svg.replace(/fill="black"/g, `fill="${textColor}"`);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  CURSOR_URL_CACHE.set(cacheKey, url);
  return url;
}

export function readWorkspaceCursorColor() {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue("--ui-text").trim();
}

export function resolveWorkspaceCursor(tool: EditorTool, textColor: string) {
  const cursor = TOOL_CURSORS[tool];
  if (!textColor) return cursor.fallback;

  const url = themedCursorUrl(tool, textColor);
  return `url("${url}") ${String(cursor.hotspotX)} ${String(cursor.hotspotY)}, ${cursor.fallback}`;
}
