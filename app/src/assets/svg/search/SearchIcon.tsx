import { useId, useMemo } from "react";

import searchSvg from "./search.svg?raw";
import { prepareRawSvgMarkup, RAW_SVG_WRAPPER_STYLE } from "../shared/rawSvg";

interface SearchIconProps {
  className?: string;
}

export default function SearchIcon({ className = "ui-icon svg-sm" }: SearchIconProps) {
  const iconId = useId().replace(/:/g, "");

  const markup = useMemo(() => {
    return prepareRawSvgMarkup(searchSvg, `search-${iconId}`, className);
  }, [className, iconId]);

  return (
    <span
      aria-hidden="true"
      style={RAW_SVG_WRAPPER_STYLE}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
