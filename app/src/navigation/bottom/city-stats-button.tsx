import MapIcon from "../../assets/svg/map/MapIcon";
import { useShallow } from "zustand/react/shallow";
import { useUiStore } from "../../app-core/state/stores/ui-store";

export default function CityStatsButton() {
  const { cityStatsOpen, setCityStatsOpen } = useUiStore(
    useShallow((s) => ({
      cityStatsOpen: s.cityStatsOpen,
      setCityStatsOpen: s.setCityStatsOpen,
    }))
  );

  return (
    <button
      type="button"
      className="btn-secondary-icon"
      aria-expanded={cityStatsOpen}
      aria-haspopup="dialog"
      aria-label="City stats"
      onClick={() => { setCityStatsOpen(!cityStatsOpen); }}
    >
      <MapIcon className="ui-icon svg-sm" />
    </button>
  );
}
