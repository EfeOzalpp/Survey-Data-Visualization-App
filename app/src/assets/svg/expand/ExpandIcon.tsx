import { useId, useMemo } from "react";

import expandAllSvg from "./expand_all.svg?raw";
import collapseAllSvg from "./collapse_all.svg?raw";
import { prepareRawSvgMarkup, RAW_SVG_WRAPPER_STYLE } from "../shared/rawSvg";

interface ExpandIconProps {
  expanded?: boolean;
  className?: string;
}

export default function ExpandIcon({ expanded = false, className = "ui-icon svg-sm" }: ExpandIconProps) {
  const iconId = useId().replace(/:/g, "");

  const markup = useMemo(() => {
    const source = expanded ? collapseAllSvg : expandAllSvg;
    return prepareRawSvgMarkup(source, `expand-${iconId}`, className);
  }, [className, expanded, iconId]);

  return (
    <span
      aria-hidden="true"
      style={RAW_SVG_WRAPPER_STYLE}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
