// Wires the static per-question button placement lookup (layout-lookup.ts)
// together with the live canvas grid measurement (useQuestionnaireGridLayout)
// into one API. Callers pass (questionId, optionIndex) only - device is
// resolved internally, so this is the one place that combines "where does
// this option go" with "how big/positioned is the grid right now".
import { useQuestionnaireGridLayout } from "./useQuestionnaireGridLayout";
import { getQuestionButtonPlacement } from "./layout-lookup";

export function useResolvedButtonLayout() {
  const { device, layout, getPlacementStyle, resolvePlacement } = useQuestionnaireGridLayout();

  const getButtonPlacementStyle = (questionId: string, optionIndex: number) =>
    getPlacementStyle(getQuestionButtonPlacement(questionId, optionIndex, device));

  const resolveButtonPlacement = (questionId: string, optionIndex: number) =>
    resolvePlacement(getQuestionButtonPlacement(questionId, optionIndex, device));

  return {
    ready: !!layout,
    getButtonPlacementStyle,
    resolveButtonPlacement,
  };
}
