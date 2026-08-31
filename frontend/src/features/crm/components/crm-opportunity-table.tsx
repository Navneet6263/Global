"use client";

import { ArrowRight } from "lucide-react";
import type { Opportunity } from "../contracts/crm";
import { STAGE_LABEL, STAGE_TONE } from "../config/crm";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatInr } from "@/lib/formatting";

interface CrmOpportunityTableProps {
  rows: readonly Opportunity[];
  onOpen: (opportunity: Opportunity) => void;
}

export function CrmOpportunityTable({ rows, onOpen }: CrmOpportunityTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse text-left">
        <thead>
          <tr className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
            <th className="px-5 py-3 font-medium">Company</th>
            <th className="px-3 py-3 font-medium">Stage</th>
            <th className="px-3 py-3 text-right font-medium">Value</th>
            <th className="px-3 py-3 text-right font-medium">Weighted</th>
            <th className="px-3 py-3 font-medium">Owner</th>
            <th className="px-3 py-3 font-medium">Expected close</th>
            <th className="px-3 py-3 font-medium">Next action</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const overdue = row.nextFollowUpAt
              ? Date.parse(row.nextFollowUpAt) < Date.now()
              : false;
            return (
              <tr
                key={row.id}
                className="border-t border-border/70 transition-colors hover:bg-mint-soft/40"
              >
                <td className="px-5 py-3">
                  <button type="button" onClick={() => onOpen(row)} className="text-left">
                    <span className="block text-[13px] font-medium text-foreground">
                      {row.company}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {[row.contactName, row.city].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </td>
                <td className="px-3 py-3">
                  <StatusBadge label={STAGE_LABEL[row.stage]} tone={STAGE_TONE[row.stage]} />
                </td>
                <td className="num px-3 py-3 text-right text-[13px] text-foreground">
                  {formatInr(row.estimatedValue, { compact: true })}
                </td>
                <td className="num px-3 py-3 text-right text-[13px] text-muted-foreground">
                  {formatInr(row.weightedValue, { compact: true })}
                  <span className="ml-1 text-[11px]">({row.probability}%)</span>
                </td>
                <td className="px-3 py-3 text-[13px] text-foreground">
                  {row.ownerName ?? <span className="text-muted-foreground">Unassigned</span>}
                </td>
                <td className="num px-3 py-3 text-[13px] text-muted-foreground">
                  {row.expectedCloseDate ? formatDate(row.expectedCloseDate) : "Not scheduled"}
                </td>
                <td className="px-3 py-3 text-[12px]">
                  {row.nextFollowUpAt ? (
                    <span className={overdue ? "text-destructive" : "text-muted-foreground"}>
                      {formatDate(row.nextFollowUpAt)}
                      {overdue ? " · overdue" : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not scheduled</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => onOpen(row)}>
                    Open
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
