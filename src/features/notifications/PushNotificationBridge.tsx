import { useEffect, useRef } from "react";
import { fetchNotificationPreferences } from "@/lib/classifieds-api";
import { initializeNativePush, resetNativePushSession } from "@/lib/native-push";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

const initializationByUser = new Map<string, Promise<void>>();

export function PushNotificationBridge() {
  const auth = useAuth();
  const { language } = useUiPreferences();
  const requestIdRef = useRef(0);
  const profileId = auth.profile?.id ?? null;

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    if (auth.status !== "signedIn" || !profileId || typeof window === "undefined") return;

    const existing = initializationByUser.get(profileId);
    if (existing) return;

    const initialization = (async () => {
      const preferences = await fetchNotificationPreferences();
      if (requestId !== requestIdRef.current || !preferences.ok || !preferences.data.pushEnabled) {
        return;
      }
      await initializeNativePush(language);
    })().finally(() => {
      initializationByUser.delete(profileId);
    });

    initializationByUser.set(profileId, initialization);
    return () => {
      requestIdRef.current += 1;
      void resetNativePushSession();
    };
  }, [auth.status, language, profileId]);

  return null;
}
