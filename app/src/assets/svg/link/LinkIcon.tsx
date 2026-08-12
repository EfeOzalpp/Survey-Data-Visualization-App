import { useId, useMemo } from "react";

import linkSvg from "./link.svg?raw";
import { prepareRawSvgMarkup, RAW_SVG_WRAPPER_STYLE } from "../shared/rawSvg";

interface LinkIconProps {
  className?: string;
}

export default function LinkIcon({ className = "ui-icon svg-sm" }: LinkIconProps) {
  const iconId = useId().replace(/:/g, "");

  const markup = useMemo(() => {
    return prepareRawSvgMarkup(linkSvg, `link-${iconId}`, className);
  }, [className, iconId]);

  return (
    <span
      aria-hidden="true"
      style={RAW_SVG_WRAPPER_STYLE}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
