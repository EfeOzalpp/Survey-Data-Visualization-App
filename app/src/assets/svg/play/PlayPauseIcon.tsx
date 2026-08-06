import { useId, useMemo } from "react";

import pauseSvg from "./pause-play.svg?raw";
import { prepareRawSvgMarkup, RAW_SVG_WRAPPER_STYLE } from "../shared/rawSvg";

interface PlayPauseIconProps {
  mode: "play" | "pause";
  className?: string;
}

const PLAY_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 6.5V17.5L17 12L8 6.5Z" fill="currentColor"/>
</svg>
`;

export default function PlayPauseIcon({ mode, className = "ui-icon" }: PlayPauseIconProps) {
  const iconId = useId().replace(/:/g, "");

  const markup = useMemo(() => {
    const svg = mode === "pause" ? pauseSvg : PLAY_SVG;
    return prepareRawSvgMarkup(svg, `play-pause-${mode}-${iconId}`, className);
  }, [className, iconId, mode]);

  return (
    <span
      aria-hidden="true"
      style={RAW_SVG_WRAPPER_STYLE}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
