"use client";

import { Mail, Phone, Trophy, XCircle } from "lucide-react";
import type { CrmStage, OpportunityDetail, SalesOwner } from "../contracts/crm";
import { CRM_STAGES, STAGE_LABEL, STAGE_TONE } from "../config/crm";
import { CrmActivityFeed } from "./crm-activity-feed";
import { CrmClientCommercial } from "./crm-client-commercial";
import { CrmCommercialWorkflow } from "./crm-commercial-workflow";
import { CrmAutoAssignment } from "./crm-auto-assignment";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatDateTime, formatIndianMobile, formatInr } from "@/lib/formatting";

interface CrmOpportunityDrawerProps {
  detail?: OpportunityDetail;
  owners: readonly SalesOwner[];
  open: boolean;
  loading?: boolean;
  canWrite: boolean;
  canAssign: boolean;
  assigning?: boolean;
  changingStage?: boolean;
  preparingOnboarding?: boolean;
  onOpenChange: (open: boolean) => void;
  onStageChange: (stage: CrmStage) => void;
  onAssign: (ownerId: string | null) => void;
  onEdit: () => void;
  onLogActivity: () => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
  onHandoff: () => void;
}

export function CrmOpportunityDrawer(props: CrmOpportunityDrawerProps) {
  const { detail, owners, open, loading, canWrite, canAssign, onOpenChange } = props;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="text-base">{detail?.company ?? "Opportunity"}</SheetTitle>
          {detail ? (
            <p className="text-[12px] text-muted-foreground">
              {[detail.contactName, detail.contactTitle, detail.city].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </SheetHeader>

        {loading || !detail ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">Loading opportunity…</p>
        ) : (
          <div className="space-y-5 px-5 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={STAGE_LABEL[detail.stage]} tone={STAGE_TONE[detail.stage]} />
              <span className="num text-[13px] font-medium text-foreground">
                {formatInr(detail.estimatedValue)}
              </span>
              <span className="num text-[12px] text-muted-foreground">
                {detail.probability}% · weighted{" "}
                {formatInr(detail.weightedValue, { compact: true })}
              </span>
              <span className="num ml-auto text-[11px] text-muted-foreground">
                Age {detail.ageDays}d
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-[12px]">
              <Field
                label="Expected close"
                value={
                  detail.expectedCloseDate ? formatDate(detail.expectedCloseDate) : "Not scheduled"
                }
              />
              <Field
                label="Next follow-up"
                value={detail.nextFollowUpAt ? formatDate(detail.nextFollowUpAt) : "Not scheduled"}
              />
              <Field label="Owner" value={detail.ownerName ?? "Unassigned"} />
              <Field label="Industry" value={detail.industry || "Not recorded"} />
              <Field label="Email" value={detail.contactEmail} />
              <Field label="Mobile" value={formatIndianMobile(detail.contactMobile)} />
              {detail.onboardingHandoffAt ? (
                <Field
                  label="Onboarding handoff"
                  value={formatDateTime(detail.onboardingHandoffAt)}
                />
              ) : null}
            </dl>

            {detail.notes ? (
              <p className="rounded-2xl bg-mint-soft/50 px-4 py-3 text-[12.5px] leading-relaxed text-foreground">
                {detail.notes}
              </p>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <Select
                value={detail.stage}
                onValueChange={(value) => props.onStageChange(value as CrmStage)}
                disabled={!canWrite || props.changingStage}
              >
                <SelectTrigger aria-label="Change stage" aria-busy={props.changingStage}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRM_STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      Move to {STAGE_LABEL[stage]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={detail.ownerId ?? "unassigned"}
                onValueChange={(value) => props.onAssign(value === "unassigned" ? null : value)}
                disabled={!canAssign || props.assigning}
              >
                <SelectTrigger aria-label="Assign owner" aria-busy={props.assigning}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              {canAssign && !detail.ownerId && !["WON", "LOST"].includes(detail.stage) && (
                <CrmAutoAssignment id={detail.id} />
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={props.onLogActivity}
                disabled={!canWrite}
              >
                <Phone className="size-3.5" aria-hidden />
                Log activity
              </Button>
              <Button size="sm" variant="outline" onClick={props.onEdit} disabled={!canWrite}>
                <Mail className="size-3.5" aria-hidden />
                Edit details
              </Button>
              <Button size="sm" onClick={props.onMarkWon} disabled={!canWrite}>
                <Trophy className="size-3.5" aria-hidden />
                Mark won
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={props.onMarkLost}
                disabled={!canWrite}
                className="text-destructive"
              >
                <XCircle className="size-3.5" aria-hidden />
                Mark lost
              </Button>
              {detail.stage === "WON" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={props.onHandoff}
                  disabled={!canWrite || detail.onboardingHandoff}
                  loading={props.preparingOnboarding}
                >
                  {props.preparingOnboarding
                    ? "Linking client workspace…"
                    : detail.onboardingHandoff
                      ? "Client workspace linked"
                      : "Create / link client workspace"}
                </Button>
              ) : null}
            </div>

            {detail.onboardingHandoff && canWrite ? (
              <CrmClientCommercial clientId={detail.accountId} company={detail.company} />
            ) : null}
            <CrmActivityFeed activities={detail.activities} limit={12} showLink={false} />
            <CrmCommercialWorkflow key={detail.id} id={detail.id} canWrite={canWrite} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] tracking-[0.08em] text-muted-foreground uppercase">{label}</dt>
      <dd className="truncate text-[12.5px] font-medium text-foreground">{value}</dd>
    </div>
  );
}
