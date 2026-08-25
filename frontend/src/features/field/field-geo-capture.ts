import { stamp, type GeoFix } from "@/components/field/geo";

export async function capturePreciseFix(): Promise<GeoFix> {
  if (!navigator.geolocation) throw new Error("Location is not supported on this device.");
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const capturedAt = new Date().toISOString();
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
          time: stamp(new Date(capturedAt)),
          capturedAt,
        });
      },
      (error) =>
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "Location permission denied — allow precise location to continue."
              : "Could not get a fresh GPS fix. Enable location services and retry.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}
