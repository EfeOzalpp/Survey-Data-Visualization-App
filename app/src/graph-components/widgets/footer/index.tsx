import { MultiButtonFooter, type MultiButtonFooterTool } from "./multi-button-footer";
import { CloseFooter } from "./close-footer";

// Desktop assembly (used by navigation/bottom/widgets-button.tsx) - stacks
// the tab strip above the close row. CompactToolsPanel instead uses the
// MultiButtonFooter with close controls in its compact-only headers.
interface WidgetsFooterProps<T extends string> {
  tools: MultiButtonFooterTool<T>[];
  activeTool: T;
  onSelectTool: (tool: T) => void;
  onClose: () => void;
  ariaLabel: string;
}

export function WidgetsFooter<T extends string>({
  tools,
  activeTool,
  onSelectTool,
  onClose,
  ariaLabel,
}: WidgetsFooterProps<T>) {
  return (
    <>
      <MultiButtonFooter tools={tools} activeTool={activeTool} onSelectTool={onSelectTool} ariaLabel={ariaLabel} />
      <CloseFooter onClose={onClose} />
    </>
  );
}

export default WidgetsFooter;
