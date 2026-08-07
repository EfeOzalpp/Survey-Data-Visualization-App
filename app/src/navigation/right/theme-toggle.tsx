import React, { useEffect, useRef } from "react";
import { usePreferences } from "../../app/state/preferences-context";
import ThemeIcon from "../../assets/svg/theme/ThemeIcon";

export default function ColorToggle() {
  const { darkMode, setDarkMode } = usePreferences();
  const textRef = useRef(darkMode ? "Dark mode" : "Light mode");

  useEffect(() => {
    textRef.current = darkMode ? "Dark mode" : "Light mode";
  }, [darkMode]);

  const toggle = (e: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDarkMode(!darkMode);
    textRef.current = !darkMode ? "Dark mode" : "Light mode";
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") toggle(e);
  };

  return (
    <button
      type="button"
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
      onKeyDown={onKeyDown}
      className={`svg-lg system-color${darkMode ? " is-dark" : ""}`}
    >
      <ThemeIcon mode={darkMode ? "light" : "dark"} />
    </button>
  );
}
