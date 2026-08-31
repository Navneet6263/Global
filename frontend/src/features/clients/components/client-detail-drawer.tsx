"use client";

import type { ClientOrganisation } from "@/lib/contracts/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/feedback/status-badge";
import { CLIENT_STATUS_META } from "../client-status-meta";
import { formatDate, formatDateTime, formatNumber, formatPercent } from "@/lib/formatting";

interface ClientDetailDrawerProps {
  client: ClientOrganisation | undefined;
  onClose: () => void;
}

export function ClientDetailDrawer({ client, onClose }: ClientDetailDrawerProps) {
  return (
    <Sheet open={Boolean(client)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="text-base">{client?.name ?? "Client account"}</SheetTitle>
          <SheetDescription>
            Registered identity, verification performance, contacts and portal access.
          </SheetDescription>
        </SheetHeader>

        {client ? <ClientAccount client={client} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function ClientAccount({ client }: { client: ClientOrganisation }) {
  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          label={CLIENT_STATUS_META[client.status].label}
          tone={CLIENT_STATUS_META[client.status].tone}
        />
        <StatusBadge label={`${client.slaCommitmentDays}-day SLA`} tone="info" withDot={false} />
        {client.slaAttainment !== null ? (
          <StatusBadge
            label={`${formatPercent(client.slaAttainment)} attainment`}
            tone={client.slaAttainment >= 95 ? "success" : "warning"}
          />
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 text-xs">
        <Detail label="Registered name" value={client.legalName} />
        <Detail label="Workspace code" value={client.code} />
        <Detail label="Onboarded" value={formatDate(client.onboardedAt)} />
        <Detail label="Total cases" value={formatNumber(client.caseVolumeTotal)} />
        <Detail label="Active cases" value={formatNumber(client.activeCases)} />
        <Detail label="At-risk cases" value={formatNumber(client.outstandingActions)} />
      </dl>

      <Tabs defaultValue="contacts">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="contacts" className="text-xs">
            Contacts ({client.contacts.length})
          </TabsTrigger>
          <TabsTrigger value="users" className="text-xs">
            Portal users ({client.users.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="pt-3">
          <AccountList empty="No primary contact has been configured.">
            {client.contacts.map((contact) => (
              <li key={contact.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground">{contact.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {[contact.designation, contact.email, contact.mobile]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {contact.isPrimary ? <StatusBadge label="Primary" tone="info" /> : null}
              </li>
            ))}
          </AccountList>
        </TabsContent>

        <TabsContent value="users" className="pt-3">
          <AccountList empty="No Client Admin ID is assigned to this workspace.">
            {client.users.map((user) => (
              <li key={user.id} className="px-4 py-3">
                <p className="text-[13px] font-medium text-foreground">{user.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {user.role} · {user.email}
                </p>
                <p className="text-[11px] text-muted-foreground/80">
                  Last login {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "never"}
                </p>
              </li>
            ))}
          </AccountList>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AccountList({ children, empty }: { children: React.ReactNode; empty: string }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {hasChildren ? (
        children
      ) : (
        <li className="px-4 py-8 text-center text-xs text-muted-foreground">{empty}</li>
      )}
    </ul>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="truncate text-[13px] text-foreground">{value}</dd>
    </div>
  );
}
