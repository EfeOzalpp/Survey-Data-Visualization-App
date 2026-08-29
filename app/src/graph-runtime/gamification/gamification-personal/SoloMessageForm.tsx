// src/graph-runtime/gamification/gamification-personal/SoloMessageForm.tsx
import type { FormEvent, KeyboardEvent } from 'react';

import { Button } from "../../../app-core/ui-generics/Button";

interface SoloMessageFormProps {
  panelId: string;
  messageDraft: string;
  isSaving: boolean;
  saveMessageDisabled: boolean;
  messageError: string;
  saveLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onDraftChange: (value: string) => void;
}

export default function SoloMessageForm({
  panelId,
  messageDraft,
  isSaving,
  saveMessageDisabled,
  messageError,
  saveLabel,
  onSubmit,
  onKeyDown,
  onDraftChange,
}: SoloMessageFormProps) {
  return (
    <form className="solo-message-form" onSubmit={onSubmit}>
      <textarea
        id={`${panelId}-message`}
        className="solo-message-input"
        aria-label="Personal message"
        value={messageDraft}
        maxLength={160}
        rows={2}
        placeholder="I've been thinking about..."
        disabled={isSaving}
        onClick={(event) => { event.stopPropagation(); }}
        onKeyDown={onKeyDown}
        onChange={(event) => { onDraftChange(event.currentTarget.value); }}
      />
      <div className="solo-message-actions">
        <span className="solo-message-count">{160 - messageDraft.length}</span>
        <Button
          baseClassName="solo-message-save"
          type="submit"
          disabled={saveMessageDisabled}
          reserveContent="Saving"
        >
          {saveLabel}
        </Button>
      </div>
      {messageError ? <p className="solo-message-state is-error" role="alert">{messageError}</p> : null}
    </form>
  );
}
