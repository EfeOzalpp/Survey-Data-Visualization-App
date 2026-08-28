import { createPortal } from 'react-dom';
import { usePreferences } from '../../app-core/state/preferences-context';

export default function DarkMode() {
  const { darkMode } = usePreferences();
  if (typeof document === 'undefined' || !darkMode) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -1,
          borderRadius: 0,
          backgroundColor: 'rgba(13, 14, 15, 0.91)',
          opacity: 1,
          transform: 'scale(1)',
          transition: 'opacity 140ms linear, transform 140ms ease-out',
          mixBlendMode: 'difference',
          willChange: 'opacity, transform',
        }}
      />
    </div>,
    document.body
  );
}
