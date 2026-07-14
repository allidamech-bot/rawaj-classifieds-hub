import { useSyncExternalStore } from "react";

type FilterDraftListener = () => void;

const activeSessions = new Set<symbol>();
const listeners = new Set<FilterDraftListener>();

function emitFilterDraftState() {
  listeners.forEach((listener) => listener());
}

export function beginFilterDraftSession() {
  const token = Symbol("filter-draft-session");
  const wasActive = activeSessions.size > 0;
  activeSessions.add(token);

  if (!wasActive) emitFilterDraftState();

  let ended = false;
  return () => {
    if (ended) return;
    ended = true;

    const wasActiveBeforeEnd = activeSessions.size > 0;
    activeSessions.delete(token);

    if (wasActiveBeforeEnd && activeSessions.size === 0) emitFilterDraftState();
  };
}

export function isFilterDraftSessionActive() {
  return activeSessions.size > 0;
}

function subscribeToFilterDraftState(listener: FilterDraftListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFilterDraftSessionActive() {
  return useSyncExternalStore(subscribeToFilterDraftState, isFilterDraftSessionActive, () => false);
}
