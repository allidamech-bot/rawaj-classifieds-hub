import { roundNearbyPoint, type NearbyPoint } from "@/lib/nearby-location";

export type NearbyGeolocationStatus =
  | "ready"
  | "unsupported"
  | "permission_denied"
  | "unavailable"
  | "timeout";

export type NearbyGeolocationResult =
  | { ok: true; point: NearbyPoint }
  | { ok: false; status: Exclude<NearbyGeolocationStatus, "ready"> };

export async function requestNearbyPosition(): Promise<NearbyGeolocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ok: false, status: "unsupported" };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          ok: true,
          point: roundNearbyPoint({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ ok: false, status: "permission_denied" });
          return;
        }
        if (error.code === error.TIMEOUT) {
          resolve({ ok: false, status: "timeout" });
          return;
        }
        resolve({ ok: false, status: "unavailable" });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000,
      },
    );
  });
}
