import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { stamp, type GeoFix } from "@/components/field/geo";
import { geoPolicy } from "@/components/field/geo";
import { completeFieldVisit, getMyFieldVisits, uploadVisitEvidence } from "@/lib/api/field-visits";
import { loadFieldDrafts, removeFieldDraft, saveFieldDraft } from "./offline-store";
import { emptyFieldDraft, type ApiFieldVisit, type FieldDraft } from "./types";

export function useFieldWorkflow() {
  const queryClient = useQueryClient();
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
  const [locating, setLocating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    void loadFieldDrafts()
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
  }, []);

  useEffect(() => {
    if (!activeId && visits[0]) setActiveId(visits[0].id);
  }, [activeId, visits]);

  const active = visits.find((visit) => visit.id === activeId) ?? visits[0];
  const draft = active
    ? (drafts[active.id] ?? emptyFieldDraft(active.id))
    : emptyFieldDraft("pending");

  const persist = useCallback((next: FieldDraft) => {
    setDrafts((current) => ({ ...current, [next.visitId]: next }));
    void saveFieldDraft(next).catch(() => toast.error("Draft could not be saved on this device"));
  }, []);

  const update = useCallback(
    (patch: Partial<FieldDraft>) => {
      if (!active) return;
      persist({ ...draft, ...patch, visitId: active.id, synced: false });
    },
    [active, draft, persist],
  );

  const captureFix = useCallback(async (): Promise<GeoFix> => {
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
  }, []);

  const capture = useCallback(
    async (kind: "checkIn" | "refresh") => {
      setLocating(true);
      setGeoError(null);
      try {
        const captured = await captureFix();
        setFix(captured);
        if (kind === "checkIn") update({ checkIn: captured });
      } catch (error) {
        setGeoError(error instanceof Error ? error.message : "Location error");
      } finally {
        setLocating(false);
      }
    },
    [captureFix, update],
  );

  const addPhotos = useCallback(
    (files: FileList) => {
      const capturedAt = new Date().toISOString();
      const photos = Array.from(files).map((file) => ({
        id: crypto.randomUUID(),
        blob: file,
        name: file.name || `field-evidence-${Date.now()}.jpg`,
        type: file.type,
        capturedAt,
      }));
      update({ photos: [...draft.photos, ...photos] });
    },
    [draft.photos, update],
  );

  const syncOne = useCallback(
    async (visit: ApiFieldVisit, value: FieldDraft) => {
      for (const photo of value.photos) await uploadVisitEvidence(visit.id, photo);
      const withoutPhotos = { ...value, photos: [], synced: !value.checkOut };
      if (value.checkOut) {
        const result = await completeFieldVisit(visit, value);
        await removeFieldDraft(visit.id);
        setDrafts((current) => {
          const next = { ...current };
          delete next[visit.id];
          return next;
        });
        toast[result.insideFence ? "success" : "warning"](
          result.insideFence ? "Visit completed" : "Sent for geofence exception review",
          { description: `${result.distanceMeters} m from target` },
        );
      } else {
        persist(withoutPhotos);
      }
      await queryClient.invalidateQueries({ queryKey: ["field-visits", "mine"] });
    },
    [persist, queryClient],
  );

  const checkout = useCallback(async () => {
    if (!active) return;
    setLocating(true);
    setGeoError(null);
    try {
      const checkOut = policy.requireCheckout ? await captureFix() : draft.checkIn;
      if (!checkOut) throw new Error("GPS check-in is required before completion");
      setFix(checkOut);
      const next = { ...draft, checkOut, synced: false };
      persist(next);
      if (online) {
        setSyncing(true);
        await syncOne(active, next);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Visit could not be completed";
      setGeoError(message);
      toast.error(message);
    } finally {
      setLocating(false);
      setSyncing(false);
    }
  }, [active, captureFix, draft, online, persist, policy.requireCheckout, syncOne]);

  const syncAll = useCallback(async () => {
    if (!online) return;
    setSyncing(true);
    try {
      for (const value of Object.values(drafts).filter((item) => !item.synced)) {
        const visit = visits.find((item) => item.id === value.visitId);
        if (visit) await syncOne(visit, value);
      }
    } catch (error) {
      toast.error("Sync paused", {
        description: error instanceof Error ? error.message : "Try again",
      });
    } finally {
      setSyncing(false);
    }
  }, [drafts, online, syncOne, visits]);

  const photoCount = (active?.evidence.length ?? 0) + draft.photos.length;
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
    syncing,
    online,
    photoCount,
    pendingSync,
    capture,
    checkout,
    addPhotos,
    syncAll,
  };
}
