import { memo } from "react";
import { useUiStore } from "../../app-core/state/stores/ui-store";
import { recordOwnRender } from "../../render-test/renderProfilerStats";

const Logo = () => {
  recordOwnRender("Logo");
  const resetToStart = useUiStore((s) => s.resetToStart);

  return (
    <button
      type="button"
      className="logo-divider"
      aria-label="Back to home"
      onClick={resetToStart}
    ><span className="logo-text" >be</span></button>
  );
};

export default memo(Logo);
