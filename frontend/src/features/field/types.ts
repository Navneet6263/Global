import type { GeoFix } from "@/components/field/geo";

export type ApiFieldVisit = {
  id: string;
  status: string;
  address: string;
  targetLatitude: string | number | null;
  targetLongitude: string | number | null;
  geofenceMeters: number;
  capturedAt: string | null;
  distanceMeters: string | number | null;
  version: number;
  case: {
    publicId: string;
    caseNumber: string;
    subject: { fullName: string };
    client: { displayName: string };
  };
  evidence: Array<{ publicId: string; type: string; capturedAt: string; createdAt: string }>;
};

export type FieldExecutionPolicy = {
  defaultRadiusMeters: number;
  maxAccuracyMeters: number;
  minimumPhotos: number;
  retentionDays: number;
  requireCheckout: boolean;
  outsideGeofencePolicy: string;
};

export type OfflinePhoto = {
  id: string;
  blob: Blob;
  name: string;
  type: string;
  capturedAt: string;
};

export type FieldDraft = {
  visitId: string;
  checkIn?: GeoFix;
  checkOut?: GeoFix;
  photos: OfflinePhoto[];
  checklist: string[];
  remarks: string;
  synced: boolean;
};

export const emptyFieldDraft = (visitId: string): FieldDraft => ({
  visitId,
  photos: [],
  checklist: [],
  remarks: "",
  synced: true,
});
