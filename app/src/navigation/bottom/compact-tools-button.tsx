import panelStyles from "../../graph-components/compact-tools/compact-tools.module.css";
import { recordOwnRender } from "../../render-test/renderProfilerStats";
import { useDisclosure } from "../../lib/hooks/useDisclosure";
import { Modal } from "../../app-core/ui-generics/Modal";
import { CompactToolsPanel } from "../../graph-components/compact-tools/compact-graph-tools";

function ToolsGridIcon() {
  return (
    <svg className="ui-icon svg-sm" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="currentColor">
        <circle cx="5" cy="5" r="1.5" />
        <circle cx="12" cy="5" r="1.5" />
        <circle cx="19" cy="5" r="1.5" />
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
        <circle cx="5" cy="19" r="1.5" />
        <circle cx="12" cy="19" r="1.5" />
        <circle cx="19" cy="19" r="1.5" />
      </g>
    </svg>
  );
}

// Owns the trigger + Modal wrapper, matching logs-button.tsx/widgets-button.tsx
// owning their own Popover for LogsPanel/BarGraph/ByQuestion - CompactToolsPanel
// itself is just content now, no button or primitive of its own.
export default function CompactToolsButton() {
  recordOwnRender("CompactToolsButton");
  const { open, setOpen, openDisclosure, closeDisclosure } = useDisclosure(false);

  return (
    <>
      <button
        type="button"
        className="btn-secondary-icon"
        aria-label="Open graph tools"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={openDisclosure}
      >
        <ToolsGridIcon />
      </button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        ariaLabel="Graph tools"
        // The stable class is used by compact-tools.module.css for the
        // tablet bottom-sheet overrides that target the surrounding Modal.
        cardClassName={`compact-tools-modal ${panelStyles.compactToolsModal}`}
        overlayLabel="Close graph tools"
      >
        <CompactToolsPanel open={open} onClose={closeDisclosure} />
      </Modal>
    </>
  );
}
