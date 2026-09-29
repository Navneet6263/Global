import {
  CheckCircle2,
  Clock3,
  FileUp,
  RotateCcw,
  Send,
  Upload,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { StatusTone } from "@/lib/contracts/common";
import { TONE_BADGE } from "@/lib/formatting/tones";
import { cn } from "@/lib/utils";
import { dateTime } from "../utils/spoc-format";
import type {
  DocumentVersionEntry,
  ReuploadRequestEntry,
  VendorAttempt,
} from "./spoc-vendor-contracts";
import { timelineSteps, type HistoryStepKind } from "./spoc-vendor-model";

const KIND: Record<HistoryStepKind, { icon: LucideIcon; tone: StatusTone }> = {
  assigned: { icon: Send, tone: "info" },
  rejected: { icon: XCircle, tone: "critical" },
  resolution: { icon: Wrench, tone: "review" },
  reassigned: { icon: RotateCcw, tone: "info" },
  approved: { icon: CheckCircle2, tone: "success" },
  pending: { icon: Clock3, tone: "neutral" },
  reupload: { icon: Upload, tone: "warning" },
  upload: { icon: FileUp, tone: "info" },
};

/**
 * Full history, oldest first: attempts (rejections stay exactly as recorded),
 * re-upload requests to the candidate and every new file version.
 */
export function VendorHistoryTimeline({
  attempts,
  reuploads,
  versions,
}: {
  attempts: readonly VendorAttempt[];
  reuploads?: readonly ReuploadRequestEntry[];
  versions?: readonly DocumentVersionEntry[];
}) {
  const steps = timelineSteps(attempts, reuploads, versions);
  if (!steps.length)
    return <p className="text-xs text-muted-foreground">Not assigned to a vendor yet.</p>;
  return (
    <ol className="space-y-3">
      {steps.map((step) => {
        const { icon: Icon, tone } = KIND[step.kind];
        const meta = [step.actor, step.at ? dateTime(step.at) : null].filter(Boolean).join(" · ");
        return (
          <li key={step.key} className="flex gap-3">
            <span
              className={cn(
                "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border",
                TONE_BADGE[tone],
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-foreground">{step.title}</p>
              {step.detail ? (
                <p className="mt-0.5 break-words whitespace-pre-wrap text-muted-foreground">
                  {step.detail}
                </p>
              ) : null}
              {meta ? <p className="mt-0.5 text-[10px] text-muted-foreground">{meta}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
