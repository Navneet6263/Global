import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LocateFixed, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Empty, Panel, Status } from "@/features/cases/case-detail-ui";
import { getSession } from "@/lib/api/auth";
import type { CaseDetail } from "@/lib/api/cases";
import { createFieldVisit, reviewFieldException } from "@/lib/api/field-visits";
import { listUsers } from "@/lib/api/users";

export function FieldVisitPanel({ item }: { item: CaseDetail }) {
  const queryClient = useQueryClient();
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [geofenceMeters, setGeofenceMeters] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [locating, setLocating] = useState(false);
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const canAssign =
    session.data?.permissions.includes("*") ||
    session.data?.permissions.includes("field-visit:write");
  const directory = useQuery({
    queryKey: ["users", "FIELD_EXECUTIVE"],
    queryFn: () => listUsers("FIELD_EXECUTIVE"),
    enabled: Boolean(canAssign && item.status === "IN_PROGRESS"),
    staleTime: 60_000,
  });
  const lat = Number(latitude);
  const lng = Number(longitude);
  const radius = geofenceMeters ? Number(geofenceMeters) : undefined;
  const valid =
    address.trim().length >= 5 &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180 &&
    Boolean(assigneeId) &&
    (radius === undefined || (Number.isInteger(radius) && radius >= 50 && radius <= 1000));
  const mutation = useMutation({
    mutationFn: () =>
      createFieldVisit(item.id, {
        address: address.trim(),
        latitude: lat,
        longitude: lng,
        assigneeId,
        ...(radius === undefined ? {} : { geofenceMeters: radius }),
      }),
    onSuccess: async () => {
      setAddress("");
      setLatitude("");
      setLongitude("");
      setGeofenceMeters("");
      setAssigneeId("");
      toast.success("Field visit assigned");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["case", item.id] }),
        queryClient.invalidateQueries({ queryKey: ["field-visits"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const review = useMutation({
    mutationFn: ({
      visitId,
      version,
      decision,
    }: {
      visitId: string;
      version: number;
      decision: "APPROVE" | "RETRY";
    }) => reviewFieldException(visitId, { decision, version }),
    onSuccess: async (result) => {
      toast.success(
        result.status === "COMPLETED" ? "Field exception approved" : "Fresh visit requested",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["case", item.id] }),
        queryClient.invalidateQueries({ queryKey: ["field-visits"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "exceptions"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location services are unavailable in this browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setLocating(false);
        toast.success("Target coordinates captured");
      },
      (error) => {
        setLocating(false);
        toast.error(error.message || "Could not capture location");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };

  return (
    <Panel title="Field verification" subtitle="Assign visits and monitor geofence outcomes">
      {canAssign && item.status === "IN_PROGRESS" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) mutation.mutate();
          }}
          className="mb-4 grid gap-2 rounded-2xl bg-secondary/30 p-3"
        >
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            maxLength={500}
            placeholder="Complete visit address"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              inputMode="decimal"
              aria-label="Target latitude"
              placeholder="Latitude"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
            <input
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              inputMode="decimal"
              aria-label="Target longitude"
              placeholder="Longitude"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
              aria-label="Field executive assignee"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Select field executive</option>
              {directory.data?.items.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} · {user.email}
                </option>
              ))}
            </select>
            <input
              value={geofenceMeters}
              onChange={(event) => setGeofenceMeters(event.target.value)}
              inputMode="numeric"
              aria-label="Geofence radius in metres"
              placeholder="Default geofence radius"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          {directory.isError ? (
            <p className="text-xs text-destructive">{directory.error.message}</p>
          ) : directory.data?.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Add an active field executive in user management before assigning a visit.
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              <LocateFixed className="h-3.5 w-3.5" />
              {locating ? "Locating…" : "Use current location"}
            </button>
            <button
              disabled={!valid || mutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <MapPin className="h-3.5 w-3.5" />
              {mutation.isPending ? "Assigning…" : "Assign field visit"}
            </button>
          </div>
        </form>
      ) : null}

      {item.fieldVisits.length ? (
        <div className="divide-y divide-[var(--hairline)]">
          {item.fieldVisits.map((visit) => (
            <div key={visit.publicId} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{visit.address}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {visit.assignee?.displayName ?? "Unassigned"} ·{" "}
                    {visit.distanceMeters == null
                      ? `${visit.geofenceMeters} m geofence`
                      : `${Math.round(visit.distanceMeters)} m from target`}
                  </p>
                </div>
                <Status status={visit.status} />
              </div>
              {canAssign && visit.status === "EXCEPTION_REVIEW" ? (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      review.mutate({
                        visitId: visit.publicId,
                        version: visit.version,
                        decision: "RETRY",
                      })
                    }
                    disabled={review.isPending}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                  >
                    Request fresh visit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      review.mutate({
                        visitId: visit.publicId,
                        version: visit.version,
                        decision: "APPROVE",
                      })
                    }
                    disabled={review.isPending}
                    className="rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-foreground disabled:opacity-50"
                  >
                    Approve exception
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <Empty text="No field visit assigned" />
      )}
    </Panel>
  );
}
