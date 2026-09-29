import { useEffect, useState } from "react";
import { CheckCircle2, PlayCircle, UserRound } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { dateTime, label } from "@/features/spoc-rm/utils/spoc-format";
import { Fact, Section } from "@/features/spoc-rm/vendors/VendorDrawerParts";
import { useSupportRequest, useUpdateSupportRequest } from "../hooks/use-support";
import {
  REQUESTER_LABEL,
  REQUEST_STATUS_META,
  SUPPORT_MESSAGE_MAX,
  isValidSupportText,
  requestActions,
} from "../support-model";

/** One support request: the query, who raised it, and the agent's only actions (start, resolve). */
export function SupportRequestDrawer({
  requestId,
  onClose,
  onOpenEmployee,
}: {
  requestId: string | undefined;
  onClose: () => void;
  onOpenEmployee: (caseId: string) => void;
}) {
  const detail = useSupportRequest(requestId);
  const update = useUpdateSupportRequest();
  const [reply, setReply] = useState("");
  const item = detail.data;
  useEffect(() => setReply(""), [requestId]);
  const status = item ? REQUEST_STATUS_META[item.status] : null;
  const actions = item ? requestActions(item.status) : null;
  const replyReady = isValidSupportText(reply, SUPPORT_MESSAGE_MAX);

  return (
    <Sheet open={Boolean(requestId)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {item?.requestNumber ?? (detail.isError ? "Request unavailable" : "Loading")}
            {status ? <StatusBadge label={status.label} tone={status.tone} /> : null}
          </SheetTitle>
          <SheetDescription>{item?.subject ?? "Support request"}</SheetDescription>
        </SheetHeader>
        {detail.isError ? (
          <div className="p-5">
            <ErrorState
              description={detail.error.message}
              onRetry={() => void detail.refetch()}
              retrying={detail.isFetching}
            />
          </div>
        ) : !item || !actions ? (
          <div className="p-5">
            <ListSkeleton rows={4} />
          </div>
        ) : (
          <div className="space-y-6 p-5">
            <Section title="Request">
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <Fact term="Requester" value={item.requesterName} />
                <Fact term="Type" value={REQUESTER_LABEL[item.requesterType]} />
                <Fact term="Client" value={item.client.displayName} />
                <Fact term="Raised" value={dateTime(item.createdAt)} />
                <Fact term="Taken by" value={item.takenBy ?? "Not taken yet"} />
                <Fact term="Last updated" value={dateTime(item.updatedAt)} />
              </dl>
              <p className="mt-3 rounded-2xl bg-muted/40 px-3 py-2 text-xs whitespace-pre-wrap">
                {item.message}
              </p>
            </Section>
            {item.employee ? (
              <Section title="Employee">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span>
                    <span className="font-semibold">{item.employee.candidateName}</span> ·{" "}
                    {item.employee.caseNumber} · {label(item.employee.caseStatus)}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenEmployee(item.employee!.caseId)}
                  >
                    <UserRound className="size-4" aria-hidden /> Open employee
                  </Button>
                </div>
              </Section>
            ) : null}
            {item.status === "RESOLVED" ? (
              <Section title="Reply sent">
                <p className="text-xs whitespace-pre-wrap">{item.resolutionNote}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Resolved {dateTime(item.resolvedAt)}
                </p>
              </Section>
            ) : (
              <Section title="Handle this request">
                {actions.canStart ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({
                        requestId: item.id,
                        status: "IN_PROGRESS",
                        version: item.version,
                      })
                    }
                  >
                    <PlayCircle className="size-4" aria-hidden /> Start working
                  </Button>
                ) : null}
                <Label className="mt-4 mb-1.5 block text-xs">
                  Reply to the requester (required to resolve)
                </Label>
                <Textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  maxLength={SUPPORT_MESSAGE_MAX}
                  rows={4}
                  placeholder="What you found and what happens next"
                />
                <Button
                  type="button"
                  className="mt-3"
                  disabled={!replyReady || update.isPending}
                  loading={update.isPending}
                  onClick={() =>
                    update.mutate({
                      requestId: item.id,
                      status: "RESOLVED",
                      version: item.version,
                      note: reply.trim(),
                    })
                  }
                >
                  <CheckCircle2 className="size-4" aria-hidden /> Resolve
                </Button>
              </Section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
