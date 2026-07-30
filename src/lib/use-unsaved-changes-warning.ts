import { useBlocker } from "@tanstack/react-router";
import { useCallback } from "react";

export function useUnsavedChangesWarning(dirty: boolean, message: string) {
  const shouldBlockFn = useCallback(() => {
    if (!dirty) return false;
    return !window.confirm(message);
  }, [dirty, message]);

  const enableBeforeUnload = useCallback(() => dirty, [dirty]);

  useBlocker({
    shouldBlockFn,
    enableBeforeUnload,
    disabled: !dirty,
    withResolver: false,
  });
}
