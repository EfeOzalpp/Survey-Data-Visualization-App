import { useId, useMemo } from "react";

import previousSvg from "./chevron_previous.svg?raw";
import nextSvg from "./chevron_next.svg?raw";
import { prepareRawSvgMarkup, RAW_SVG_WRAPPER_STYLE } from "../shared/rawSvg";

interface ChevronIconProps {
  direction: "previous" | "next";
  className?: string;
}

export default function ChevronIcon({ direction, className = "ui-icon svg-sm" }: ChevronIconProps) {
  const iconId = useId().replace(/:/g, "");

  const markup = useMemo(() => {
    const svg = direction === "previous" ? previousSvg : nextSvg;
    return prepareRawSvgMarkup(svg, `chevron-${direction}-${iconId}`, className);
  }, [className, direction, iconId]);

  return (
    <span
      aria-hidden="true"
      style={RAW_SVG_WRAPPER_STYLE}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
