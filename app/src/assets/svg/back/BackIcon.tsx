import { useId, useMemo } from "react";

import backSvg from "./arrow_back.svg?raw";
import { prepareRawSvgMarkup, RAW_SVG_WRAPPER_STYLE } from "../shared/rawSvg";

interface BackIconProps {
  className?: string;
}

export default function BackIcon({ className = "ui-icon svg-md" }: BackIconProps) {
  const iconId = useId().replace(/:/g, "");

  const markup = useMemo(() => {
    return prepareRawSvgMarkup(backSvg, `back-${iconId}`, className);
  }, [className, iconId]);

  return (
    <span
      aria-hidden="true"
      style={RAW_SVG_WRAPPER_STYLE}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
