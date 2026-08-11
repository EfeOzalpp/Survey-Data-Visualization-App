import SelectMove from "./select-move";
import Zoom from "./zoom";
import styles from "../side-tools.module.css";

export default function Orient() {
  return (
    <div className={styles.orient}>
      <SelectMove />
      <Zoom />
    </div>
  );
}
