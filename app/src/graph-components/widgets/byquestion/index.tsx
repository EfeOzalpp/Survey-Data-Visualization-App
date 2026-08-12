import WidgetsHeader from "../widgets-header";
import ByQuestionBody from "./body";
import { useByQuestion } from "./lib/useByQuestion";

interface ByQuestionProps {
  panelClassName: string;
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
}

// Standard widgets assembly. Compact tools imports the shared hook, header,
// and body separately so it can provide its own header chrome.
export function ByQuestion({ panelClassName, paused, onPausedChange }: ByQuestionProps) {
  const byQuestion = useByQuestion({ paused, onPausedChange });

  return (
    <>
      <WidgetsHeader {...byQuestion.header} />
      <ByQuestionBody
        navOutsidePanel
        panelClassName={panelClassName}
        avgs={byQuestion.avgs}
        tooltipIndex={byQuestion.tooltipIndex}
        setTooltipIndex={byQuestion.setTooltipIndex}
        listRef={byQuestion.listRef}
      />
    </>
  );
}

export default ByQuestion;
