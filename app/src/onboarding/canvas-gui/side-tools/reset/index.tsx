import { useId, useState } from "react";

import Button from "../../../../app/ui/Button";
import { Popover } from "../../../../app/ui/Popover";
import CloseIcon from "../../../../assets/svg/close/CloseIcon";
import GuiIcon from "../../../../assets/svg/gui/GuiIcon";
import { HoverHintTarget } from "../../shared/hover-hint";
import shared from "../side-tools.module.css";
import styles from "./reset.module.css";

export default function Reset() {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <HoverHintTarget copy="Reset canvas" disabled={open}>
      <Popover
        open={open}
        onOpenChange={setOpen}
        placement="right"
        className={styles.popover}
        trigger={
          <button
            type="button"
            className={`ui-icon-nav-button ${shared.button}${open ? " is-active" : ""}`}
            aria-label="Reset canvas"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => { setOpen((current) => !current); }}
          >
            <GuiIcon name="reset" className="ui-icon svg-sm" />
          </button>
        }
      >
        <section
          role="alertdialog"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          <header className={styles.header}>
            <h4 id={titleId} className={styles.title}>Reset Canvas</h4>
            <button
              type="button"
              className={`ui-icon-nav-button ${styles.closeButton}`}
              aria-label="Close reset confirmation"
              onClick={() => { setOpen(false); }}
            >
              <CloseIcon className="ui-close svg-sm" />
            </button>
          </header>
          <div className={styles.body}>
            <p id={descriptionId} className={styles.message}>
              This will reset your Canvas.
            </p>
            <div className={styles.actions}>
              <Button
                variant="secondary"
                baseClassName={styles.proceedButton}
                onClick={() => { setOpen(false); }}
              >
                Proceed
              </Button>
            </div>
          </div>
        </section>
      </Popover>
    </HoverHintTarget>
  );
}
