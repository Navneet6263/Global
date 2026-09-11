import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { GeoFix } from "@/components/field/geo";
import { geoPolicy } from "@/components/field/geo";
import {
  checkInFieldVisit,
  completeFieldVisit,
  getMyFieldVisits,
  uploadVisitEvidence,
} from "@/lib/api/field-visits";
import { cachedIdentity } from "@/lib/auth/platform-session";
import { loadFieldDrafts, removeFieldDraft, saveFieldDraft } from "./offline-store";
import { emptyFieldDraft, type ApiFieldVisit, type FieldDraft } from "./types";
import { capturePreciseFix } from "./field-geo-capture";
import { prepareEvidencePhotos } from "./evidence-files";

export function useFieldWorkflow() {
  const queryClient = useQueryClient();
  const deviceDataScope = cachedIdentity()?.deviceDataScope;
  const visitsQuery = useQuery({ queryKey: ["field-visits", "mine"], queryFn: getMyFieldVisits });
  const visits = useMemo(() => visitsQuery.data?.items ?? [], [visitsQuery.data?.items]);
  const policy = visitsQuery.data?.policy ?? {
    defaultRadiusMeters: geoPolicy.defaultRadiusM,
    maxAccuracyMeters: geoPolicy.maxAccuracyM,
    minimumPhotos: geoPolicy.minPhotos,
    retentionDays: geoPolicy.retentionDays,
    requireCheckout: geoPolicy.requireCheckout,
    outsideGeofencePolicy: "SUPERVISOR_APPROVAL",
  };
  const [activeId, setActiveId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, FieldDraft>>({});
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [captureAction, setCaptureAction] = useState<"checkIn" | "refresh" | "checkout" | null>(
    null,
  );
  const locating = captureAction !== null;
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (!deviceDataScope) {
      toast.error("Secure offline storage is unavailable for this session");
      return;
    }
    void loadFieldDrafts(deviceDataScope)
      .then(setDrafts)
      .catch(() => toast.error("Offline visit storage is unavailable"));
    setOnline(navigator.onLine);
    const wentOnline = () => setOnline(true);
    const wentOffline = () => setOnline(false);
    window.addEventListener("online", wentOnline);
    window.addEventListener("offline", wentOffline);
    return () => {
      window.removeEventListener("online", wentOnline);
      window.removeEventListener("offline", wentOffline);
    };
  }, [deviceDataScope]);
  useEffect(() => {
    const preferred = visits.find((visit) => ["ASSIGNED", "IN_PROGRESS"].includes(visit.status));
    if (!activeId && (preferred ?? visits[0])) setActiveId((preferred ?? visits[0])!.id);
  }, [activeId, visits]);

  const active = visits.find((visit) => visit.id === activeId) ?? visits[0];
  const draft = active
    ? (drafts[active.id] ?? emptyFieldDraft(active.id))
    : emptyFieldDraft("pending");
  const persist = useCallback(
    async (next: FieldDraft) => {
      if (!deviceDataScope) throw new Error("Authenticated offline scope is unavailable");
      setDrafts((current) => ({ ...current, [next.visitId]: next }));
      await saveFieldDraft(deviceDataScope, next).catch(() => {
        toast.error("Draft could not be saved on this device");
        throw new Error("Offline draft could not be saved");
      });
    },
    [deviceDataScope],
  );
  const update = useCallback(
    (patch: Partial<FieldDraft>) => {
      if (!active) return;
      void persist({ ...draft, ...patch, visitId: active.id, synced: false });
    },
    [active, draft, persist],
  );
  const captureFix = useCallback(() => capturePreciseFix(), []);

  const capture = useCallback(
    async (kind: "checkIn" | "refresh") => {
      setCaptureAction(kind);
      setGeoError(null);
      try {
        const captured = await captureFix();
        if (captured.accuracy > policy.maxAccuracyMeters) {
          throw new Error(`GPS accuracy must be ${policy.maxAccuracyMeters} metres or better.`);
        }
        setFix(captured);
        if (kind === "checkIn" && active) {
          let next: FieldDraft = {
            ...draft,
            visitId: active.id,
            checkIn: captured,
            checkInSynced: false,
            synced: false,
          };
          if (online) {
            const result = await checkInFieldVisit(active, captured, draft.serverVersion);
            next = { ...next, checkInSynced: true, serverVersion: result.version };
          }
          await persist(next);
          if (online) {
            await queryClient.invalidateQueries({ queryKey: ["field-visits", "mine"] });
          }
        }
      } catch (error) {
        setGeoError(error instanceof Error ? error.message : "Location error");
      } finally {
        setCaptureAction(null);
      }
    },
    [active, captureFix, draft, online, persist, policy.maxAccuracyMeters, queryClient],
  );

  const addPhotos = useCallback(
    (files: FileList) => {
      const { photos, errors } = prepareEvidencePhotos(files, draft.photos.length);
      errors.forEach((message) => toast.error(message));
      if (photos.length) update({ photos: [...draft.photos, ...photos] });
    },
    [draft.photos, update],
  );

  const syncOne = useCallback(
    async (visit: ApiFieldVisit, value: FieldDraft) => {
      let working = value;
      let serverVersion = value.serverVersion ?? visit.version;
      if (working.checkIn && !working.checkInSynced) {
        const result = await checkInFieldVisit(visit, working.checkIn, serverVersion);
        serverVersion = result.version;
        working = { ...working, checkInSynced: true, serverVersion };
        await persist(working);
      }
      for (const photo of [...working.photos]) {
        await uploadVisitEvidence(visit.id, photo);
        working = {
          ...working,
          photos: working.photos.filter((item) => item.id !== photo.id),
          serverVersion,
        };
        await persist(working);
      }
      const withoutPhotos = { ...working, photos: [], synced: !working.checkOut };
      if (working.checkOut) {
        const result = await completeFieldVisit(visit, working, serverVersion);
        if (!deviceDataScope) throw new Error("Authenticated offline scope is unavailable");
        await removeFieldDraft(deviceDataScope, visit.id);
        setDrafts((current) => {
          const next = { ...current };
          delete next[visit.id];
          return next;
        });
        toast[result.status === "EXCEPTION_REVIEW" ? "warning" : "success"](
          result.status === "COMPLETED"
            ? "Visit completed"
            : result.status === "EXCEPTION_REVIEW"
              ? "Sent for geofence exception review"
              : "Visit submitted for supervisor review",
          { description: `${result.distanceMeters} m from target` },
        );
      } else {
        await persist(withoutPhotos);
      }
      await queryClient.invalidateQueries({ queryKey: ["field-visits", "mine"] });
    },
    [deviceDataScope, persist, queryClient],
  );

  const checkout = useCallback(async () => {
    if (!active) return;
    setCaptureAction("checkout");
    setGeoError(null);
    try {
      const checkOut = policy.requireCheckout ? await captureFix() : draft.checkIn;
      if (!checkOut) throw new Error("GPS check-in is required before completion");
      if (checkOut.accuracy > policy.maxAccuracyMeters) {
        throw new Error(`GPS accuracy must be ${policy.maxAccuracyMeters} metres or better.`);
      }
      setFix(checkOut);
      const next = { ...draft, checkOut, synced: false };
      await persist(next);
      if (online) {
        setSyncing(true);
        await syncOne(active, next);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Visit could not be completed";
      setGeoError(message);
      toast.error(message);
    } finally {
      setCaptureAction(null);
      setSyncing(false);
    }
  }, [
    active,
    captureFix,
    draft,
    online,
    persist,
    policy.maxAccuracyMeters,
    policy.requireCheckout,
    syncOne,
  ]);

  const syncAll = useCallback(async () => {
    if (!online) return;
    setSyncing(true);
    try {
      let failed = 0;
      for (const value of Object.values(drafts).filter((item) => !item.synced)) {
        const visit = visits.find((item) => item.id === value.visitId);
        if (!visit) {
          failed += 1;
          continue;
        }
        try {
          await syncOne(visit, value);
        } catch {
          failed += 1;
        }
      }
      if (failed) {
        toast.error(`${failed} visit draft${failed === 1 ? "" : "s"} could not sync`, {
          description: "Refresh assignments, then retry while online.",
        });
      }
    } finally {
      setSyncing(false);
    }
  }, [drafts, online, syncOne, visits]);

  const photoCount = (active?.evidence.length ?? 0) + draft.photos.length;
  const removePhoto = useCallback(
    (photoId: string) => update({ photos: draft.photos.filter((photo) => photo.id !== photoId) }),
    [draft.photos, update],
  );
  const pendingSync = useMemo(
    () => Object.values(drafts).filter((item) => !item.synced).length,
    [drafts],
  );

  return {
    visitsQuery,
    visits,
    policy,
    active,
    activeId,
    setActiveId,
    draft,
    update,
    fix,
    geoError,
    locating,
    captureAction,
    syncing,
    online,
    photoCount,
    pendingSync,
    capture,
    checkout,
    addPhotos,
    removePhoto,
    syncAll,
  };
}
