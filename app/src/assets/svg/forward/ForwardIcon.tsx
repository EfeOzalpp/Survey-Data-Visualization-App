import { useId, useMemo } from "react";

import forwardSvg from "./forward.svg?raw";
import { prepareRawSvgMarkup, RAW_SVG_WRAPPER_STYLE } from "../shared/rawSvg";

interface ForwardIconProps {
  className?: string;
}

export default function ForwardIcon({ className = "ui-icon svg-md" }: ForwardIconProps) {
  const iconId = useId().replace(/:/g, "");

  const markup = useMemo(() => {
    return prepareRawSvgMarkup(forwardSvg, `forward-${iconId}`, className);
  }, [className, iconId]);

  return (
    <span
      aria-hidden="true"
      style={RAW_SVG_WRAPPER_STYLE}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
