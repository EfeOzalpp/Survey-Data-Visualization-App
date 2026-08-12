import { useId, useMemo } from "react";

import closeSvg from "./close.svg?raw";
import { prepareRawSvgMarkup, RAW_SVG_WRAPPER_STYLE } from "../shared/rawSvg";

interface CloseIconProps {
  className?: string;
}

export default function CloseIcon({ className = "ui-close svg-sm" }: CloseIconProps) {
  const iconId = useId().replace(/:/g, "");

  const markup = useMemo(() => {
    return prepareRawSvgMarkup(closeSvg, `close-${iconId}`, className);
  }, [className, iconId]);

  return (
    <span
      aria-hidden="true"
      style={RAW_SVG_WRAPPER_STYLE}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
