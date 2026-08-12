import { useId, useMemo } from "react";

import brushSvg from "./brush/brush.svg?raw";
import canvasSvg from "./canvas/canvas.svg?raw";
import desktopSvg from "./devices/desktop/desktop.svg?raw";
import mobileSvg from "./devices/mobile/mobile.svg?raw";
import tabletSvg from "./devices/tablet/tablet.svg?raw";
import eraseSvg from "./erase/erase.svg?raw";
import closeFullscreenSvg from "./fullscreen/close_fullscreen.svg?raw";
import fullscreenSvg from "./fullscreen/fullscreen.svg?raw";
import gridOffSvg from "./grid/grid_off.svg?raw";
import gridOnSvg from "./grid/grid_on.svg?raw";
import collapseToolingSvg from "./hide-tooling/collapse.svg?raw";
import expandToolingSvg from "./hide-tooling/expand.svg?raw";
import moveSvg from "./move/move.svg?raw";
import resetSvg from "./reset/reset.svg?raw";
import responsiveSvg from "./responsive/responsive_layout.svg?raw";
import selectSvg from "./select/select.svg?raw";
import terminalSvg from "./terminal/terminal.svg?raw";
import zoomInSvg from "./zoom/zoom_in.svg?raw";
import zoomOutSvg from "./zoom/zoom_out.svg?raw";
import horizonSvg from "./horizon/horizon.svg?raw";
import { prepareRawSvgMarkup, RAW_SVG_WRAPPER_STYLE } from "../shared/rawSvg";

const GUI_ICONS = {
  brush: brushSvg,
  canvas: canvasSvg,
  desktop: desktopSvg,
  mobile: mobileSvg,
  tablet: tabletSvg,
  erase: eraseSvg,
  closeFullscreen: closeFullscreenSvg,
  fullscreen: fullscreenSvg,
  gridOff: gridOffSvg,
  gridOn: gridOnSvg,
  collapseTooling: collapseToolingSvg,
  expandTooling: expandToolingSvg,
  move: moveSvg,
  reset: resetSvg,
  responsive: responsiveSvg,
  select: selectSvg,
  terminal: terminalSvg,
  zoomIn: zoomInSvg,
  zoomOut: zoomOutSvg,
  row: horizonSvg,
} as const;

interface GuiIconProps {
  name: keyof typeof GUI_ICONS;
  className?: string;
}

export default function GuiIcon({ name, className = "ui-icon svg-md" }: GuiIconProps) {
  const iconId = useId().replace(/:/g, "");

  const markup = useMemo(() => {
    return prepareRawSvgMarkup(GUI_ICONS[name], `gui-${name}-${iconId}`, className);
  }, [className, iconId, name]);

  return (
    <span
      aria-hidden="true"
      style={RAW_SVG_WRAPPER_STYLE}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
