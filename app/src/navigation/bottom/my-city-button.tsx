import { useShallow } from "zustand/react/shallow";
import { useUiStore } from "../../app/state/ui-store";

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
    <button
      type="button"
      className="city-button city-close-btn"
      data-label={cityPanelOpen ? "Back" : "My city"}
      onClick={() => { setCityPanelOpen(!cityPanelOpen); }}
      aria-label={cityPanelOpen ? "Back to questionnaire" : "Open city view"}
    >
      <span className="city-button__inner">
        <span>{cityPanelOpen ? "Back" : "My city"}</span>
      </span>
    </button>
  );
}
