import { RotateCcw, Send, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TONE_BADGE } from "@/lib/formatting/tones";
import { cn } from "@/lib/utils";
import { dateTime } from "../utils/spoc-format";
import type { SpocVendorDocumentDetail } from "./spoc-vendor-contracts";
import { Fact } from "./VendorDrawerParts";

/**
 * The drawer's vendor status: current attempt, the re-upload loop and only the
 * actions the server allows (assign, re-assign, re-upload).
 */
export function VendorStatusPanel({
  item,
  onAssign,
  onReassign,
  onReupload,
}: {
  item: SpocVendorDocumentDetail;
  onAssign: () => void;
  onReassign: () => void;
  onReupload: () => void;
}) {
  const current = item.current;
  return (
    <>
      {current ? (
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <Fact term="Vendor" value={current.vendor.name} />
          <Fact term="Assigned" value={dateTime(current.assignedAt)} />
          <Fact term="Decided" value={dateTime(current.decidedAt)} />
          <Fact term="Attempt" value={String(current.attempt)} />
          {current.status === "REJECTED" ? (
            <div className="col-span-2">
              <Fact term="Rejection reason" value={current.reason ?? "—"} />
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="text-xs text-muted-foreground">Not assigned to a vendor yet.</p>
      )}
      <ReuploadNotice item={item} />
      <div className="mt-3 flex flex-wrap gap-2">
        {item.canAssign ? (
          <Button type="button" onClick={onAssign}>
            <Send className="size-4" aria-hidden /> Assign to vendor
          </Button>
        ) : null}
        {item.canReassign ? (
          <Button type="button" onClick={onReassign}>
            <RotateCcw className="size-4" aria-hidden /> Re-assign
          </Button>
        ) : null}
        {item.canRequestReupload ? (
          <Button type="button" variant="outline" onClick={onReupload}>
            <Upload className="size-4" aria-hidden /> Re-upload
          </Button>
        ) : null}
      </div>
    </>
  );
}

function ReuploadNotice({ item }: { item: SpocVendorDocumentDetail }) {
  const { reupload } = item;
  if (reupload.state === "NONE") return null;
  const waiting = reupload.state === "REQUESTED";
  return (
    <div
      className={cn(
        "mt-3 rounded-2xl border px-3 py-2 text-xs",
        TONE_BADGE[waiting ? "warning" : "info"],
      )}
    >
      <p className="font-semibold">
        {waiting
          ? "Waiting for the candidate's re-upload"
          : `New version v${item.file?.version ?? "?"} ready — re-assign to send it to a vendor`}
      </p>
      {waiting && reupload.message ? (
        <p className="mt-0.5 break-words whitespace-pre-wrap">{reupload.message}</p>
      ) : null}
      {waiting ? (
        <p className="mt-1 text-[10px]">
          Requested {dateTime(reupload.requestedAt)} ·{" "}
          {item.candidateLink
            ? `candidate link active until ${dateTime(item.candidateLink.expiresAt)}`
            : "no active candidate link — ask Operations to re-issue it"}
        </p>
      ) : null}
    </div>
  );
}
