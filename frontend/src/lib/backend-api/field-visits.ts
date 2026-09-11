import type {
  ApiFieldVisit,
  FieldDraft,
  FieldExecutionPolicy,
  OfflinePhoto,
} from "@/features/field/types";
import type { GeoFix } from "@/components/field/geo";
import { apiRequest } from "./client";
import { apiDownload } from "./client";
import { fileSha256 } from "./file-digest";

export function getMyFieldVisits() {
  return apiRequest<{ items: ApiFieldVisit[]; policy: FieldExecutionPolicy }>("/field-visits/mine");
}

export async function getFieldAssignees(caseId: string) {
  const items: Array<{ id: string; displayName: string; email: string }> = [];
  for (let page = 1; ; page += 1) {
    const result = await apiRequest<{ items: typeof items; total: number }>(
      `/cases/${caseId}/field-assignees?page=${page}&pageSize=100`,
    );
    items.push(...result.items);
    if (result.items.length === 0 || items.length >= result.total) return { items };
  }
}

export function createFieldVisit(
  caseId: string,
  input: {
    address: string;
    latitude: number;
    longitude: number;
    geofenceMeters?: number;
    assigneeId: string;
  },
) {
  return apiRequest<{
    id: string;
    status: string;
    address: string;
    geofenceMeters: number;
    version: number;
    createdAt: string;
  }>(`/cases/${caseId}/field-visits`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function reviewFieldException(
  visitId: string,
  input: { decision: "APPROVE" | "RETRY"; version: number; note?: string },
) {
  return apiRequest<{ id: string; status: string; version: number }>(
    `/field-visits/${visitId}/exception`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export async function viewFieldEvidence(evidenceId: string) {
  const blob = await apiDownload(`/field-evidence/${evidenceId}/content`);
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.download = `field-evidence-${evidenceId}.jpg`;
    link.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function uploadVisitEvidence(visitId: string, photo: OfflinePhoto) {
  const body = new FormData();
  body.append("file", photo.blob, photo.name);
  const digest = await fileSha256(photo.blob);
  return apiRequest<{ id: string }>(`/field-visits/${visitId}/evidence`, {
    method: "POST",
    headers: {
      "x-captured-at": photo.capturedAt,
      "x-evidence-id": photo.id,
      "x-content-sha256": digest,
    },
    body,
  });
}

export function checkInFieldVisit(visit: ApiFieldVisit, fix: GeoFix, version = visit.version) {
  return apiRequest<{ id: string; status: string; checkedInAt: string; version: number }>(
    `/field-visits/${visit.id}/check-in`,
    {
      method: "POST",
      body: JSON.stringify({
        latitude: fix.lat,
        longitude: fix.lng,
        accuracyMeters: fix.accuracy,
        capturedAt: fix.capturedAt,
        version,
      }),
    },
  );
}

export function completeFieldVisit(
  visit: ApiFieldVisit,
  draft: FieldDraft,
  version = visit.version,
) {
  if (!draft.checkOut) throw new Error("GPS check-out is required");
  return apiRequest<{
    id: string;
    status: string;
    insideFence: boolean;
    distanceMeters: number;
    allowedMeters: number;
    version: number;
  }>(`/field-visits/${visit.id}/complete`, {
    method: "PATCH",
    body: JSON.stringify({
      latitude: draft.checkOut.lat,
      longitude: draft.checkOut.lng,
      accuracyMeters: draft.checkOut.accuracy,
      capturedAt: draft.checkOut.capturedAt,
      version,
      checklist: draft.checklist,
      remarks: draft.remarks || undefined,
    }),
  });
}
