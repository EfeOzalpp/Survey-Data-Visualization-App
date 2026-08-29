import { lazy, Profiler, Suspense } from "react";
import { useSurveyDataStore } from "../../../app-core/state/stores/survey-data-store";
import { GraphDataProvider } from "../../../graph-runtime/GraphDataContext";
import { profilerOnRender } from "../../../render-test/renderProfilerStats";
import WidgetsHeader from "../widgets-header";
import { useBarGraph } from "./lib/useBarGraph";

const BarGraphBody = lazy(() => import("./body"));

interface BarGraphProps {
  panelClassName: string;
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
  profilerId: string;
}

// Standard widgets assembly. Compact tools imports the shared hook, header,
// and body separately so it can provide its own header chrome.
export function BarGraph({ panelClassName, paused, onPausedChange, profilerId }: BarGraphProps) {
  const allFilteredRows = useSurveyDataStore((state) => state.allFilteredRows);
  const bar = useBarGraph({ paused, onPausedChange });

  return (
    <GraphDataProvider data={allFilteredRows}>
      {bar.ready && <WidgetsHeader {...bar.header} />}
      <Suspense fallback={null}>
        <Profiler id={profilerId} onRender={profilerOnRender}>
          <BarGraphBody {...bar} navOutsidePanel panelClassName={panelClassName} />
        </Profiler>
      </Suspense>
    </GraphDataProvider>
  );
}

export default BarGraph;
