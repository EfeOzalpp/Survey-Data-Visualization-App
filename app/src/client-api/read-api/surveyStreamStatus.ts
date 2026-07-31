import { useSyncExternalStore } from 'react';

export type SurveyStreamStatus = 'idle' | 'connecting' | 'live' | 'reconnecting';

let status: SurveyStreamStatus = 'idle';
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => {
    listener();
  });
}

export function setSurveyStreamStatus(next: SurveyStreamStatus) {
  if (status === next) return;
  status = next;
  emit();
}

export function subscribeSurveyStreamStatus(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readSurveyStreamStatus() {
  return status;
}

export function useSurveyStreamStatus() {
  return useSyncExternalStore(
    subscribeSurveyStreamStatus,
    readSurveyStreamStatus,
    () => 'idle'
  );
}
