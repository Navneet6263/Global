export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoFix extends GeoPoint {
  accuracy: number;
  time: string;
  capturedAt: string;
}

/** Default geofence policy — mirrors the admin settings screen. */
export const geoPolicy = {
  defaultRadiusM: 150,
  maxAccuracyM: 50,
  minPhotos: 3,
  requireCheckout: true,
  outsideGeofence: "supervisor-approval" as const,
  retentionDays: 365,
};

/** Great-circle distance in metres. */
export function distanceM(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export type GeoVerdict = "inside" | "edge" | "outside";

export function verdictFor(distance: number, radius = geoPolicy.defaultRadiusM): GeoVerdict {
  if (distance <= radius) return "inside";
  if (distance <= radius * 2) return "edge";
  return "outside";
}

export const verdictTone: Record<GeoVerdict, "success" | "warning" | "destructive"> = {
  inside: "success",
  edge: "warning",
  outside: "destructive",
};

export const verdictLabel: Record<GeoVerdict, string> = {
  inside: "Inside geofence",
  edge: "Near boundary",
  outside: "Geofence mismatch",
};

export function formatDistance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

export function formatCoord(p: GeoPoint): string {
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
}

export function stamp(d = new Date()): string {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}
