import {
  Camera,
  Check,
  Crosshair,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  ShieldAlert,
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
import { EvidencePreview } from "./EvidencePreview";
import { FieldControl, FieldStepStrip, FieldVisitStatus } from "./FieldVisitParts";
import type { ApiFieldVisit, FieldDraft, FieldExecutionPolicy } from "./types";

type FieldVisitCardProps = {
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
};

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
}: FieldVisitCardProps) {
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
    <section className="surface-float overflow-hidden rounded-[1.75rem]">
      <header className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              Selected visit
            </p>
            <h1 className="mt-1.5 truncate text-xl font-semibold tracking-[-0.025em]">
              {visit.case.subject.fullName}
            </h1>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {visit.case.caseNumber} · {visit.case.client.displayName}
            </p>
          </div>
          <FieldVisitStatus status={visit.status} />
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-[1rem] bg-secondary/50 p-3 text-xs leading-5 text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>{visit.address}</span>
        </div>
      </header>

      <FieldStepStrip
        checkedIn={checkedIn}
        photoReady={photoCount >= policy.minimumPhotos}
        checklistReady={draft.checklist.length >= 2}
        complete={visit.status === "COMPLETED"}
      />

      {!active ? (
        <LockedVisit status={visit.status} />
      ) : (
        <div className="space-y-4 p-4 sm:p-5">
          <section className="rounded-[1.25rem] border border-info/10 bg-info-soft/65 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-white/80 text-info">
                  <Crosshair className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-info-foreground">Event location</p>
                  <p className="text-[9px] text-muted-foreground">
                    Radius {visit.geofenceMeters} m · accuracy ≤ {policy.maxAccuracyMeters} m
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onCapture("refresh")}
                disabled={locating}
                className="rounded-full bg-white px-3 py-2 text-[10px] font-semibold text-info-foreground shadow-sm disabled:opacity-50"
              >
                {locating ? "Locating…" : "Refresh GPS"}
              </button>
            </div>
            {reference ? (
              <div className="mt-3 rounded-[1rem] bg-white/70 p-3 text-[10px] leading-5 text-muted-foreground">
                <p>
                  {formatCoord(reference)} · ±{reference.accuracy} m · {reference.time}
                </p>
                <p>
                  {hasTarget ? `Target ${formatCoord(target)}` : "Target unavailable"} ·{" "}
                  {distance === null ? "—" : `${formatDistance(distance)} away`}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-[10px] leading-5 text-muted-foreground">
                Reach the address, then capture GPS check-in. Continuous tracking is never used.
              </p>
            )}
            {geoError ? (
              <p className="mt-3 flex gap-2 rounded-[1rem] bg-critical-soft p-3 text-[10px] leading-4 text-critical-foreground">
                <ShieldAlert className="size-3.5 shrink-0" />
                {geoError}
              </p>
            ) : null}
            {verdict ? (
              <p
                className={`mt-3 rounded-[1rem] p-3 text-[10px] font-semibold ${verdict === "inside" && accuracyOk ? "bg-success-soft text-success-foreground" : "bg-warning-soft text-warning-foreground"}`}
              >
                {verdictLabel[verdict]}
                {!accuracyOk
                  ? ` · improve accuracy to ${policy.maxAccuracyMeters} m or better`
                  : verdict !== "inside"
                    ? " · supervisor review may be required"
                    : ""}
              </p>
            ) : null}
          </section>

          <div className="grid grid-cols-2 gap-2">
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
              disabled={!hasTarget}
              href={
                hasTarget
                  ? `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}`
                  : undefined
              }
            />
            <FieldControl
              icon={Camera}
              label="Add evidence"
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

          <section className="rounded-[1.25rem] bg-secondary/50 p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">Evidence queue</p>
                <p className="mt-0.5 text-[9px] text-muted-foreground">
                  {visit.evidence.length} uploaded · {draft.photos.length} on device
                </p>
              </div>
              <span className="num rounded-full bg-white px-2.5 py-1 text-[10px] text-muted-foreground">
                {photoCount}/{policy.minimumPhotos}
              </span>
            </div>
            {draft.photos.length ? (
              <div className="mt-3 space-y-2">
                {draft.photos.map((photo) => (
                  <EvidencePreview
                    key={photo.id}
                    photo={photo}
                    onRemove={() => onRemovePhoto(photo.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-[1rem] border border-dashed border-border p-4 text-center text-[10px] text-muted-foreground">
                New photos appear here before secure upload.
              </p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function LockedVisit({ status }: { status: string }) {
  const completed = status === "COMPLETED";
  return (
    <div
      className={`m-4 rounded-[1.25rem] p-4 ${completed ? "bg-success-soft" : "bg-warning-soft"}`}
    >
      <p
        className={`flex items-center gap-2 text-sm font-semibold ${completed ? "text-success-foreground" : "text-warning-foreground"}`}
      >
        <Check className="size-4" />
        {completed ? "Visit completed and locked" : "Awaiting supervisor review"}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Evidence and location controls are read-only for this visit state.
      </p>
    </div>
  );
}
