import WidgetsHeader, { type WidgetsHeaderProps } from "../../widgets/widgets-header";
import { CloseButton } from "../close-button";
import styles from "../compact-tools.module.css";

interface CompactWidgetHeaderProps extends WidgetsHeaderProps {
  onClose: () => void;
}

export function CompactWidgetHeader({ onClose, ...headerProps }: CompactWidgetHeaderProps) {
  return (
    <div className={styles.compactHeader}>
      <div className={styles.compactHeaderContent}>
        <WidgetsHeader {...headerProps} />
      </div>
      <CloseButton onClose={onClose} />
    </div>
  );
}

export default CompactWidgetHeader;
