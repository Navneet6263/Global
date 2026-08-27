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
import { formatDate, formatDateTime, formatInr, formatPercent } from "@/lib/formatting";

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
            Commercials, contacts, packages and the account change history.
          </SheetDescription>
        </SheetHeader>

        {client ? (
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={CLIENT_STATUS_META[client.status].label}
                tone={CLIENT_STATUS_META[client.status].tone}
              />
              <StatusBadge
                label={`${client.slaCommitmentDays}-day SLA`}
                tone="info"
                withDot={false}
              />
              <StatusBadge
                label={`${formatPercent(client.slaAttainment)} attainment`}
                tone={client.slaAttainment >= 95 ? "success" : "warning"}
              />
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 text-xs">
              <Detail label="Industry" value={`${client.industry} · ${client.city}`} />
              <Detail label="Onboarded" value={formatDate(client.onboardedAt)} />
              <Detail
                label="Invoiced this quarter"
                value={formatInr(client.billing.invoicedThisQuarter)}
              />
              <Detail label="Outstanding" value={formatInr(client.billing.outstanding)} />
              <Detail label="Payment terms" value={`${client.billing.paymentTermsDays} days`} />
              <Detail
                label="Last payment"
                value={
                  client.billing.lastPaymentAt ? formatDate(client.billing.lastPaymentAt) : "—"
                }
              />
            </dl>

            <Tabs defaultValue="contacts">
              <TabsList className="w-full flex-wrap justify-start">
                <TabsTrigger value="contacts" className="text-xs">
                  Contacts
                </TabsTrigger>
                <TabsTrigger value="packages" className="text-xs">
                  Packages
                </TabsTrigger>
                <TabsTrigger value="users" className="text-xs">
                  Portal users
                </TabsTrigger>
                <TabsTrigger value="audit" className="text-xs">
                  History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="contacts" className="pt-3">
                <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                  {client.contacts.map((contact) => (
                    <li key={contact.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-foreground">{contact.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {contact.designation} · {contact.email} · {contact.mobile}
                        </p>
                      </div>
                      {contact.isPrimary ? <StatusBadge label="Primary" tone="info" /> : null}
                    </li>
                  ))}
                </ul>
              </TabsContent>

              <TabsContent value="packages" className="pt-3">
                <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                  {client.packages.map((pkg) => (
                    <li key={pkg.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-foreground">{pkg.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {pkg.checks} checks · {pkg.slaDays}-day SLA
                        </p>
                      </div>
                      <span className="num text-[13px] font-semibold text-foreground">
                        {formatInr(pkg.unitPrice)}
                      </span>
                    </li>
                  ))}
                </ul>
              </TabsContent>

              <TabsContent value="users" className="pt-3">
                <ul className="divide-y divide-border rounded-xl border border-border bg-card">
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
                </ul>
              </TabsContent>

              <TabsContent value="audit" className="pt-3">
                <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                  {client.audit.map((entry) => (
                    <li key={entry.id} className="px-4 py-3">
                      <p className="text-[13px] text-foreground">{entry.action}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {entry.actor} · {formatDateTime(entry.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
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
