import {
  Camera,
  Clock3,
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
import type { ApiFieldVisit, FieldDraft, FieldExecutionPolicy } from "./types";

const stateTone: Record<string, string> = {
  ASSIGNED: "bg-secondary text-muted-foreground",
  IN_PROGRESS: "bg-info/12 text-info",
  COMPLETED: "bg-accent text-accent-foreground",
  EXCEPTION_REVIEW: "bg-warning/25 text-warning-foreground",
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
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const target = {
    lat: Number(visit.targetLatitude),
    lng: Number(visit.targetLongitude),
  };
  const hasTarget = Number.isFinite(target.lat) && Number.isFinite(target.lng);
  const reference = fix ?? draft.checkIn ?? null;
  const distance = reference && hasTarget ? distanceM(target, reference) : null;
  const verdict = distance === null ? null : verdictFor(distance, visit.geofenceMeters);
  const accuracyOk = reference ? reference.accuracy <= policy.maxAccuracyMeters : true;
  const canCheckout =
    Boolean(draft.checkIn) && photoCount >= policy.minimumPhotos && draft.checklist.length >= 2;

  return (
    <section className="surface rounded-3xl p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Active visit</h2>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${stateTone[visit.status] ?? stateTone["ASSIGNED"]}`}
        >
          {visit.status.replaceAll("_", " ").toLowerCase()}
        </span>
      </div>
      <p className="text-sm font-medium">{visit.case.subject.fullName}</p>
      <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
        <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {visit.address}
      </p>
      <p className="num mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Clock3 className="h-3 w-3" /> {visit.case.caseNumber} · geofence {visit.geofenceMeters} m
      </p>

      <div className="mt-3 rounded-2xl bg-secondary/70 p-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <Crosshair className="h-3.5 w-3.5" /> Precise GPS
          </p>
          <button
            type="button"
            onClick={() => onCapture("refresh")}
            disabled={locating}
            className="rounded-full bg-card px-3 py-1 text-[11px] font-medium disabled:opacity-60"
          >
            {locating ? "Locating…" : "Refresh"}
          </button>
        </div>
        {reference ? (
          <div className="num mt-2 space-y-1 text-[11px] text-muted-foreground">
            <p>
              {formatCoord(reference)} · ±{reference.accuracy} m · {reference.time}
            </p>
            <p>
              {hasTarget ? `Target ${formatCoord(target)}` : "Target unavailable"} ·{" "}
              {distance === null ? "—" : `${formatDistance(distance)} away`}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Capture a fresh location at check-in. Background tracking is never used.
          </p>
        )}
        {geoError && (
          <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-destructive/12 px-2.5 py-2 text-[11px] text-destructive">
            <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" /> {geoError}
          </p>
        )}
        {verdict && (
          <p
            className={`num mt-2 rounded-xl px-2.5 py-2 text-[11px] font-medium ${
              verdict === "inside"
                ? "bg-accent text-accent-foreground"
                : verdict === "edge"
                  ? "bg-warning/25 text-warning-foreground"
                  : "bg-destructive/12 text-destructive"
            }`}
          >
            {verdictLabel[verdict]}
            {verdict !== "inside" ? " — supervisor review required" : ""}
            {!accuracyOk ? ` · accuracy above ${policy.maxAccuracyMeters} m target` : ""}
          </p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onCapture("checkIn")}
          disabled={Boolean(draft.checkIn) || locating}
          className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-primary text-xs font-medium text-primary-foreground disabled:opacity-40"
        >
          <LogIn className="h-4 w-4" />{" "}
          {draft.checkIn ? `In ${draft.checkIn.time}` : "GPS check-in"}
        </button>
        <button
          type="button"
          onClick={onCheckout}
          disabled={!canCheckout || Boolean(draft.checkOut) || locating || syncing}
          className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-secondary text-xs font-medium disabled:opacity-40"
        >
          <LogOut className="h-4 w-4" /> {syncing ? "Submitting…" : "Complete visit"}
        </button>
        <a
          href={
            hasTarget
              ? `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}`
              : undefined
          }
          target="_blank"
          rel="noreferrer"
          className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-secondary text-xs font-medium"
        >
          <Navigation className="h-4 w-4" /> Navigate
        </a>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-accent text-xs font-medium text-accent-foreground"
        >
          <Camera className="h-4 w-4" /> Capture photo
        </button>
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
      </div>
      <p className="num mt-2 text-[11px] text-muted-foreground">
        {photoCount}/{policy.minimumPhotos} evidence photos · pending photos remain in device queue
      </p>
    </section>
  );
}
