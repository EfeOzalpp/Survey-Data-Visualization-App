import LogsHeader, { type LogsHeaderProps } from "../../logs/logs-header";
import { CloseButton } from "../close-button";
import styles from "../compact-tools.module.css";

interface CompactLogsHeaderProps extends LogsHeaderProps {
  onClose: () => void;
}

export function CompactLogsHeader({ onClose, ...headerProps }: CompactLogsHeaderProps) {
  return (
    <div className={`${styles.compactHeader} ${styles.compactLogsHeader}`}>
      <div className={styles.compactHeaderContent}>
        <LogsHeader {...headerProps} />
      </div>
      <CloseButton onClose={onClose} />
    </div>
  );
}

export default CompactLogsHeader;
