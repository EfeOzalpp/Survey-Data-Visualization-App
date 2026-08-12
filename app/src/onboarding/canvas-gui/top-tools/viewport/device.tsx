import { Popover } from "../../../../app/ui/Popover";
import GuiIcon from "../../../../assets/svg/gui/GuiIcon";
import { HoverHintTarget } from "../../shared/hover-hint";
import type { DeviceKey } from "../../state/editor-state-context";
import shared from "../top-tools.module.css";
import styles from "./device.module.css";

const DEVICES = [
  { key: "mobile", label: "Mobile" },
  { key: "tablet", label: "Tablet" },
  { key: "desktop", label: "Desktop" },
] as const satisfies readonly { key: DeviceKey; label: string }[];

interface DeviceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeDevice: DeviceKey;
  onDeviceChange: (device: DeviceKey) => void;
}

export default function Device({
  open,
  onOpenChange,
  activeDevice,
  onDeviceChange,
}: DeviceProps) {
  const chooseDevice = (device: DeviceKey) => {
    onDeviceChange(device);
    onOpenChange(false);
  };

  return (
    <HoverHintTarget copy={`Preview device: ${activeDevice}`} disabled={open}>
      <Popover
        open={open}
        onOpenChange={onOpenChange}
        placement="bottom"
        className={styles.popover}
        role="menu"
        trigger={
          <button
            type="button"
            className={`ui-icon-nav-button ${shared.iconButton}${open ? " is-active" : ""}`}
            aria-label={`Choose preview device. Current device: ${activeDevice}`}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => { onOpenChange(!open); }}
          >
            <GuiIcon name={activeDevice} className="ui-icon svg-md" />
          </button>
        }
      >
        <div className={styles.menu}>
          {DEVICES.map((device) => {
            const active = device.key === activeDevice;

            return (
              <button
                key={device.key}
                type="button"
                role="menuitemradio"
                className={`${styles.option}${active ? ` ${styles.optionActive}` : ""}`}
                aria-checked={active}
                onClick={() => { chooseDevice(device.key); }}
              >
                <GuiIcon name={device.key} className="ui-icon svg-md" />
                <span>{device.label}</span>
              </button>
            );
          })}
        </div>
      </Popover>
    </HoverHintTarget>
  );
}
