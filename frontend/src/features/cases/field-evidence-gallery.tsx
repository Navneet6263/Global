import { useRef, useState } from "react";
import { Camera, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CaseDetail } from "@/lib/backend-api/cases";
import { downloadFieldEvidence, viewFieldEvidence } from "@/lib/backend-api/field-visits";
import { formatDateTime } from "@/lib/formatting";

export function FieldEvidenceGallery({ visits }: { visits: CaseDetail["fieldVisits"] }) {
  return (
    <section
      aria-label="Field photos"
      className="space-y-4 rounded-2xl border border-teal-100 bg-teal-50/30 p-4"
    >
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-teal-900">
          <Camera className="size-4" aria-hidden />
          Field photos
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Photos load only when you choose Preview or Download. Candidate documents remain in
          Documents.
        </p>
      </div>
      {!visits.length ? (
        <p className="text-sm text-muted-foreground">No field visit assigned to this case.</p>
      ) : (
        visits.map((visit) => (
          <article
            key={visit.publicId}
            className="min-w-0 space-y-3 rounded-xl border border-border/70 bg-white p-3"
          >
            <header className="space-y-1 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="break-words font-semibold">{visit.address}</h4>
                <span className="rounded-full bg-teal-50 px-2 py-1 font-medium capitalize text-teal-800">
                  {visit.status === "COMPLETED"
                    ? "Approved"
                    : visit.status.toLowerCase().replaceAll("_", " ")}
                </span>
              </div>
              <p className="break-words text-muted-foreground">
                Assigned to:{" "}
                {visit.assignee
                  ? `${visit.assignee.displayName} · ${visit.assignee.email}`
                  : "Not assigned"}
              </p>
              {visit.completedAt ? (
                <p className="text-muted-foreground">
                  Completed {formatDateTime(visit.completedAt)}
                </p>
              ) : null}
            </header>
            {(visit.evidence ?? []).map((file, index) => (
              <FieldPhoto key={file.publicId} file={file} number={index + 1} />
            ))}
            {!visit.evidence?.length ? (
              <p className="text-xs text-muted-foreground">
                {visit._count?.evidence
                  ? "Evidence exists, but photo details are unavailable in this view. Reopen the case or contact your administrator."
                  : "No photos uploaded for this visit yet."}
              </p>
            ) : null}
          </article>
        ))
      )}
    </section>
  );
}

function FieldPhoto({
  file,
  number,
}: {
  file: NonNullable<CaseDetail["fieldVisits"][number]["evidence"]>[number];
  number: number;
}) {
  const [pending, setPending] = useState<"preview" | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  async function open(action: "preview" | "download") {
    if (busy.current) return;
    busy.current = true;
    setPending(action);
    setError(null);
    try {
      await (action === "preview"
        ? viewFieldEvidence(file.publicId)
        : downloadFieldEvidence(file.publicId));
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Could not open this photo. Please try again.",
      );
    } finally {
      busy.current = false;
      setPending(null);
    }
  }
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs">
          <p className="font-medium">Field photo {number}</p>
          {file.capturedAt ? (
            <p className="mt-1 text-muted-foreground">Captured {formatDateTime(file.capturedAt)}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending !== null}
            loading={pending === "preview"}
            onClick={() => void open("preview")}
            aria-label={`Preview field photo ${number}`}
          >
            <Eye className="size-4" aria-hidden />
            Preview
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending !== null}
            loading={pending === "download"}
            onClick={() => void open("download")}
            aria-label={`Download field photo ${number}`}
          >
            <Download className="size-4" aria-hidden />
            Download
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
