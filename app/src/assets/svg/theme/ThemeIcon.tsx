import { useMemo } from "react";

import darkModeSvg from "./dark_mode.svg?raw";
import lightModeSvg from "./light_mode.svg?raw";
import { prepareRawSvgMarkup, RAW_SVG_WRAPPER_STYLE } from "../shared/rawSvg";

interface ThemeIconProps {
  mode: "dark" | "light";
  className?: string;
}

export default function ThemeIcon({ mode, className = "ui-icon" }: ThemeIconProps) {
  const markup = useMemo(() => {
    const svg = mode === "dark" ? darkModeSvg : lightModeSvg;
    // Only one ThemeIcon is ever mounted at a time, so `mode` alone is a
    // stable, unique-enough id scope — no useId() needed, which sidesteps
    // an SSR/hydration id mismatch (useId's counter depends on every prior
    // useId()-consuming component rendering identically server vs client).
    return prepareRawSvgMarkup(svg, `theme-${mode}`, className);
  }, [className, mode]);

  return (
    <span
      aria-hidden="true"
      style={RAW_SVG_WRAPPER_STYLE}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
