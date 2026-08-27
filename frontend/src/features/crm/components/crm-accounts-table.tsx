"use client";

import type { SalesAccount } from "../contracts/crm";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatIndianMobile, formatInr } from "@/lib/formatting";
import type { StatusTone } from "@/lib/contracts/common";

const STATUS_TONE: Record<SalesAccount["status"], StatusTone> = {
  prospect: "info",
  active: "success",
  dormant: "neutral",
  "churn-risk": "critical",
};

const STATUS_LABEL: Record<SalesAccount["status"], string> = {
  prospect: "Prospect",
  active: "Active client",
  dormant: "Dormant",
  "churn-risk": "Churn risk",
};

interface CrmAccountsTableProps {
  rows: readonly SalesAccount[];
  onOpen: (account: SalesAccount) => void;
}

export function CrmAccountsTable({ rows, onOpen }: CrmAccountsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-left">
        <thead>
          <tr className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
            <th className="px-5 py-3 font-medium">Account</th>
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 text-right font-medium">Open deals</th>
            <th className="px-3 py-3 text-right font-medium">Pipeline</th>
            <th className="px-3 py-3 text-right font-medium">Won revenue</th>
            <th className="px-3 py-3 font-medium">Primary contact</th>
            <th className="px-3 py-3 font-medium">Last activity</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-t border-border/70 transition-colors hover:bg-mint-soft/40"
            >
              <td className="px-5 py-3">
                <span className="block text-[13px] font-medium text-foreground">{row.company}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {row.industry} · {row.city}
                </span>
              </td>
              <td className="px-3 py-3">
                <StatusBadge label={STATUS_LABEL[row.status]} tone={STATUS_TONE[row.status]} />
              </td>
              <td className="num px-3 py-3 text-right text-[13px] text-foreground">
                {row.openOpportunities}
              </td>
              <td className="num px-3 py-3 text-right text-[13px] text-foreground">
                {formatInr(row.pipelineValue, { compact: true })}
              </td>
              <td className="num px-3 py-3 text-right text-[13px] text-muted-foreground">
                {formatInr(row.wonRevenue, { compact: true })}
              </td>
              <td className="px-3 py-3 text-[12.5px]">
                <span className="block text-foreground">{row.primaryContact}</span>
                <span className="num block text-[11px] text-muted-foreground">
                  {formatIndianMobile(row.contactMobile)}
                </span>
              </td>
              <td className="num px-3 py-3 text-[12px] text-muted-foreground">
                {row.lastActivityAt ? formatDate(row.lastActivityAt) : "No activity"}
              </td>
              <td className="px-5 py-3 text-right">
                <Button size="sm" variant="ghost" onClick={() => onOpen(row)}>
                  View deals
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
