import { useShallow } from "zustand/react/shallow";
import { useUiStore } from "../../app-core/state/stores/ui-store";
import { Button } from "../../app-core/ui-generics/Button";

export default function MyCityButton() {
  const { cityPanelOpen, questionnaireOpen, setCityPanelOpen } = useUiStore(
    useShallow((s) => ({
      cityPanelOpen: s.cityPanelOpen,
      questionnaireOpen: s.questionnaireOpen,
      setCityPanelOpen: s.setCityPanelOpen,
    }))
  );

  if (!cityPanelOpen && !questionnaireOpen) return null;

  return (
    <Button
      variant="secondary"
      baseClassName="city-button"
      modifierClassName="city-close-btn"
      onClick={() => { setCityPanelOpen(!cityPanelOpen); }}
      aria-label={cityPanelOpen ? "Back to questionnaire" : "Open city view"}
    >
      {cityPanelOpen ? "Back" : "My city"}
    </Button>
  );
}
