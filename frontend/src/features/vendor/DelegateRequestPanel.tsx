import { useState } from "react";
import { BellRing, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/formatting";
import { useVendorTeam } from "./team/use-vendor-team";
import { useDelegateRequest, useRemindRequest } from "./use-vendor-requests";
import type { VendorRequestDetail } from "./vendor-contracts";

const SELF = "self";

/**
 * Main Vendor only (the server sends canDelegate): choose who handles this pending
 * request (yourself or an active team user) and nudge them with a reminder.
 */
export function DelegateRequestPanel({ item }: { item: VendorRequestDetail }) {
  const team = useVendorTeam(item.canDelegate);
  const delegate = useDelegateRequest();
  const remind = useRemindRequest();
  const current = item.handler?.id ?? SELF;
  const [choice, setChoice] = useState(current);
  const active = (team.data?.members ?? []).filter((member) => member.status === "ACTIVE");

  return (
    <section className="space-y-2 rounded-2xl border border-border p-3">
      <p className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        Handled by
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={choice} onValueChange={setChoice} disabled={delegate.isPending}>
          <SelectTrigger className="h-8 w-56 text-xs" aria-label="Handled by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SELF}>Me (main vendor)</SelectItem>
            {active.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          disabled={choice === current || delegate.isPending}
          loading={delegate.isPending}
          onClick={() =>
            delegate.mutate({
              requestId: item.id,
              handlerId: choice === SELF ? null : choice,
              version: item.version,
            })
          }
        >
          <UserCheck className="size-3.5" aria-hidden /> Save
        </Button>
        {item.handler ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!item.canRemind || remind.isPending}
            title={item.canRemind ? undefined : "One reminder per hour"}
            onClick={() => remind.mutate(item.id)}
          >
            <BellRing className="size-3.5" aria-hidden /> Send reminder
          </Button>
        ) : null}
      </div>
      {!active.length && team.data ? (
        <p className="text-[10px] text-muted-foreground">
          No active team users. Create them on the Team page.
        </p>
      ) : null}
      {item.lastRemindedAt ? (
        <p className="text-[10px] text-muted-foreground">
          Last reminder {formatDateTime(item.lastRemindedAt)}
        </p>
      ) : null}
    </section>
  );
}
