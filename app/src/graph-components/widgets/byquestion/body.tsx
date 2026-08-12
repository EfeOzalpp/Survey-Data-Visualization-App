import type { Dispatch, Ref, SetStateAction } from "react";
import HintBanner from "../../../app/ui/HintBanner";
import { BUTTON_QUESTIONS } from "../../../onboarding/questionnaire/button-input/button-questions";
import styles from "./bq.module.css";

interface ByQuestionBodyProps {
  navOutsidePanel?: boolean;
  panelClassName?: string;
  avgs: number[];
  tooltipIndex: number | null;
  setTooltipIndex: Dispatch<SetStateAction<number | null>>;
  listRef: Ref<HTMLDivElement>;
}

export function ByQuestionBody({
  navOutsidePanel = false,
  panelClassName,
  avgs,
  tooltipIndex,
  setTooltipIndex,
  listRef,
}: ByQuestionBodyProps) {
  const scoresList = (
    <div className={styles.list} ref={listRef}>
      {BUTTON_QUESTIONS.map((q, i) => {
        const pct = Math.round(avgs[i] * 100);
        return (
          <div
            key={q.id}
            className={`${styles.item}${tooltipIndex === i ? ` ${styles.active}` : ""}`}
            role="button"
            tabIndex={0}
            aria-label={`${q.prompt}: ${String(pct)}%`}
            aria-pressed={tooltipIndex === i}
            onPointerEnter={(e) => {
              if (e.pointerType !== "touch") setTooltipIndex(i);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType !== "touch") setTooltipIndex(null);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (e.pointerType === "touch") setTooltipIndex(i);
            }}
            onClick={(e) => {
              e.stopPropagation();
              setTooltipIndex(i);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              setTooltipIndex(i);
            }}
          >
            <div className={styles.itemHead}>
              <span className={styles.prompt}>{q.prompt}</span>
            </div>
            <div className={styles.track}>
              <div
                className={styles.fill}
                style={{ width: `${String(pct)}%` }}
              />
            </div>
            <div className={styles.percentageTip}>
              <HintBanner visible={tooltipIndex === i}>{pct}%</HintBanner>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (navOutsidePanel) {
    return (
      <div className={panelClassName}>
        <div className={styles.panel}>
          {scoresList}
        </div>
      </div>
    );
  }

  return <div className={styles.panel}>{scoresList}</div>;
}

export default ByQuestionBody;
