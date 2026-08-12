import styles from "../widgets.module.css";

// Generic tab-toggle strip - the "footer" area that switches which body is
// showing. Generic over the tool-key union so it fits both the desktop
// 2-tool case (WidgetsButton: bar/questions) and CompactToolsPanel's 3-tool
// case (logs/bar/questions) without either faking a shape it doesn't have.
// Used standalone by CompactToolsPanel (close lives in its compact headers)
// and together with CloseFooter by ./index.tsx (desktop).
export interface MultiButtonFooterTool<T extends string> {
  key: T;
  label: string;
}

interface MultiButtonFooterProps<T extends string> {
  tools: MultiButtonFooterTool<T>[];
  activeTool: T;
  onSelectTool: (tool: T) => void;
  ariaLabel: string;
}

export function MultiButtonFooter<T extends string>({
  tools,
  activeTool,
  onSelectTool,
  ariaLabel,
}: MultiButtonFooterProps<T>) {
  return (
    <div className={styles.tabStrip} role="tablist" aria-label={ariaLabel}>
      {tools.map((tool) => (
        <button
          key={tool.key}
          type="button"
          className={`ui-toggle-option ${styles.tab}${activeTool === tool.key ? " is-active" : ""}`}
          role="tab"
          aria-selected={activeTool === tool.key}
          onClick={() => { onSelectTool(tool.key); }}
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
}

export default MultiButtonFooter;
