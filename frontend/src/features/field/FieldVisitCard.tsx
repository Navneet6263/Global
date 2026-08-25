import {
  Camera,
  Check,
  Clock3,
  Crosshair,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useRef } from "react";

import {
  distanceM,
  formatCoord,
  formatDistance,
  verdictFor,
  verdictLabel,
  type GeoFix,
} from "@/components/field/geo";
import type { ApiFieldVisit, FieldDraft, FieldExecutionPolicy } from "./types";
import { FieldControl, FieldStepStrip, FieldVisitStatus } from "./FieldVisitParts";

export function FieldVisitCard({
  visit,
  draft,
  fix,
  photoCount,
  geoError,
  locating,
  syncing,
  policy,
  onCapture,
  onCheckout,
  onPhotos,
  onRemovePhoto,
}: {
  visit: ApiFieldVisit;
  draft: FieldDraft;
  fix: GeoFix | null;
  photoCount: number;
  geoError: string | null;
  locating: boolean;
  syncing: boolean;
  policy: FieldExecutionPolicy;
  onCapture: (kind: "checkIn" | "refresh") => void;
  onCheckout: () => void;
  onPhotos: (files: FileList) => void;
  onRemovePhoto: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const target = { lat: Number(visit.targetLatitude), lng: Number(visit.targetLongitude) };
  const hasTarget = Number.isFinite(target.lat) && Number.isFinite(target.lng);
  const storedFix =
    visit.checkedInAt && visit.checkInLatitude !== null && visit.checkInLongitude !== null
      ? {
          lat: Number(visit.checkInLatitude),
          lng: Number(visit.checkInLongitude),
          accuracy: Number(visit.checkInAccuracy),
          capturedAt: visit.checkedInAt,
          time: new Date(visit.checkedInAt).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }
      : null;
  const reference = fix ?? draft.checkIn ?? storedFix;
  const distance = reference && hasTarget ? distanceM(target, reference) : null;
  const verdict = distance === null ? null : verdictFor(distance, visit.geofenceMeters);
  const accuracyOk = reference ? reference.accuracy <= policy.maxAccuracyMeters : false;
  const active = ["ASSIGNED", "IN_PROGRESS"].includes(visit.status);
  const checkedIn = Boolean(draft.checkIn || visit.checkedInAt);
  const canCheckout =
    active &&
    checkedIn &&
    accuracyOk &&
    photoCount >= policy.minimumPhotos &&
    draft.checklist.length >= 2;
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
              Selected visit
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">{visit.case.subject.fullName}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {visit.case.caseNumber} · {visit.case.client.displayName}
            </p>
          </div>
          <FieldVisitStatus status={visit.status} />
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-600">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-600" /> {visit.address}
        </p>
      </div>
      <FieldStepStrip
        checkedIn={checkedIn}
        photoReady={photoCount >= policy.minimumPhotos}
        checklistReady={draft.checklist.length >= 2}
        complete={!active}
      />
      {!active ? (
        <div className="m-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <Check className="h-4 w-4" />{" "}
            {visit.status === "COMPLETED"
              ? "Visit completed and locked"
              : "Awaiting supervisor review"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Evidence and location controls are readonly for this visit state.
          </p>
        </div>
      ) : (
        <>
          <div className="m-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-blue-700">
                <Crosshair className="h-4 w-4" /> Precise event location
              </p>
              <button
                type="button"
                onClick={() => onCapture("refresh")}
                disabled={locating}
                className="rounded-lg bg-white px-3 py-2 text-[10px] font-semibold shadow-sm disabled:opacity-50"
              >
                {locating ? "Locating…" : "Refresh fix"}
              </button>
            </div>
            {reference ? (
              <div className="mt-3 space-y-1 text-[10px] text-slate-500">
                <p>
                  {formatCoord(reference)} · ±{reference.accuracy} m · {reference.time}
                </p>
                <p>
                  {hasTarget ? `Target ${formatCoord(target)}` : "Target unavailable"} ·{" "}
                  {distance === null ? "—" : `${formatDistance(distance)} away`}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[10px] text-slate-500">
                Capture check-in only after reaching the visit location.
              </p>
            )}
            {geoError ? (
              <p className="mt-3 flex gap-2 rounded-lg bg-red-50 p-2 text-[10px] text-red-700">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                {geoError}
              </p>
            ) : null}
            {verdict ? (
              <p
                className={`mt-3 rounded-lg p-2 text-[10px] font-semibold ${verdict === "inside" && accuracyOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
              >
                {verdictLabel[verdict]}
                {!accuracyOk
                  ? ` · improve accuracy to ${policy.maxAccuracyMeters} m or better`
                  : verdict !== "inside"
                    ? " · supervisor review may be required"
                    : ""}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 px-4">
            <FieldControl
              primary
              icon={LogIn}
              label={checkedIn ? "Checked in" : "GPS check-in"}
              disabled={checkedIn || locating}
              onClick={() => onCapture("checkIn")}
            />
            <FieldControl
              icon={Navigation}
              label="Navigate"
              href={
                hasTarget
                  ? `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}`
                  : undefined
              }
            />
            <FieldControl
              icon={Camera}
              label="Capture evidence"
              onClick={() => inputRef.current?.click()}
            />
            <FieldControl
              icon={LogOut}
              label={syncing ? "Submitting…" : "Complete visit"}
              disabled={!canCheckout || locating || syncing}
              onClick={onCheckout}
            />
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files?.length) onPhotos(event.target.files);
              event.target.value = "";
            }}
          />
          <div className="m-4 rounded-xl bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Evidence queue</p>
              <span className="text-[10px] text-slate-500">
                {photoCount}/{policy.minimumPhotos} required
              </span>
            </div>
            {draft.photos.length ? (
              <div className="mt-2 space-y-2">
                {draft.photos.map((photo) => (
                  <div key={photo.id} className="flex items-center gap-2 rounded-lg bg-white p-2">
                    <Camera className="h-3.5 w-3.5 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-semibold">{photo.name}</p>
                      <p className="text-[9px] text-slate-400">
                        {Math.max(1, Math.round(photo.blob.size / 1024))} KB · pending sync
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemovePhoto(photo.id)}
                      className="rounded-md p-1.5 text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[10px] text-slate-400">
                New photos will show here before secure upload.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
