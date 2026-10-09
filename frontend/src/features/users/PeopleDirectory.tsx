import { useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  KeyRound,
  MoreHorizontal,
  Search,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColumnPicker } from "@/components/table/column-picker";
import { useColumnChoice } from "@/components/table/use-column-choice";
import { ROLES, ROLE_DEFINITIONS, type Role } from "@/config/roles";
import { listUsers, type DirectoryUser } from "@/lib/backend-api/users";
import { formatDateTime } from "@/lib/formatting";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type Column = "roles" | "team" | "companies" | "lastLogin" | "status" | "created";
const COLUMNS: ReadonlyArray<{ key: Column; label: string }> = [
  { key: "roles", label: "Role" },
  { key: "team", label: "Team" },
  { key: "companies", label: "Companies" },
  { key: "lastLogin", label: "Last sign-in" },
  { key: "status", label: "Status" },
  { key: "created", label: "Created" },
];
const DEFAULTS: Column[] = ["roles", "team", "lastLogin", "status"];
const PAGE_SIZES = [10, 25, 50];
type StatusFilter = "" | "ACTIVE" | "INVITED" | "SUSPENDED";

export interface PeopleActions {
  onViewActivity?: (user: DirectoryUser) => void;
  onEditRoles?: (user: DirectoryUser) => void;
  onResetPassword?: (user: DirectoryUser) => void;
  onToggleStatus?: (user: DirectoryUser) => void;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

function lastSeen(value?: string | null) {
  if (!value) return "Never";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

function statusOf(user: DirectoryUser) {
  if (user.status === "SUSPENDED") return { label: "Suspended", tone: "is-bad" };
  if (user.mustChangePassword) return { label: "Must set password", tone: "is-warn" };
  return { label: "Active", tone: "is-good" };
}

const roleLabel = (role: { code: string; name: string; customRole?: string }) =>
  role.customRole ? role.name : (ROLE_DEFINITIONS[role.code as Role]?.label ?? role.name);

/**
 * Everyone with a login in your scope: summary boxes, search, role and status filters,
 * chosen columns, row actions and real pagination. Used by Admin and Operations.
 */
export function PeopleDirectory({
  title,
  description,
  storageKey,
  actions,
  busyIds = [],
  headerAction,
}: {
  title: string;
  description: string;
  storageKey: string;
  actions?: PeopleActions;
  busyIds?: readonly string[];
  headerAction?: ReactNode;
}) {
  const [text, setText] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const search = useDebouncedValue(text.trim());
  const { columns, update, show } = useColumnChoice<Column>(storageKey, COLUMNS, DEFAULTS);
  const users = useQuery({
    queryKey: ["users", "people", search, role, status, page, pageSize],
    queryFn: () =>
      listUsers({
        search: search || undefined,
        role: role || undefined,
        status: status || undefined,
        page,
        pageSize,
      }),
    placeholderData: keepPreviousData,
  });
  const data = users.data;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  const summary = data?.summary;
  const boxes: Array<{
    label: string;
    value?: number;
    filter: StatusFilter;
    icon: LucideIcon;
    tone: string;
  }> = [
    { label: "Everyone", value: summary?.total, filter: "", icon: UsersRound, tone: "is-info" },
    { label: "Active", value: summary?.active, filter: "ACTIVE", icon: UserCheck, tone: "is-good" },
    {
      label: "Must set password",
      value: summary?.invited,
      filter: "INVITED",
      icon: KeyRound,
      tone: "is-action",
    },
    {
      label: "Suspended",
      value: summary?.suspended,
      filter: "SUSPENDED",
      icon: UserMinus,
      tone: "is-bad",
    },
  ];
  const hasActions = Boolean(
    actions?.onEditRoles ||
    actions?.onResetPassword ||
    actions?.onToggleStatus ||
    actions?.onViewActivity,
  );

  return (
    <div className="rmo">
      <section className="rmo-kpis oa-kpis pd-kpis" aria-label="People summary">
        {boxes.map((box) => (
          <button
            key={box.label}
            type="button"
            className={`rmo-kpi ${box.tone}`}
            aria-pressed={status === box.filter}
            onClick={() => {
              setStatus(box.filter);
              setPage(1);
            }}
          >
            <box.icon aria-hidden />
            <div>
              <small>{box.label}</small>
              <strong>{box.value ?? "—"}</strong>
            </div>
          </button>
        ))}
      </section>

      <section className="rmo-card rmo-queue" aria-label={title}>
        <header className="rmo-queue-head">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          {headerAction}
        </header>
        <div className="pd-toolbar">
          <label className="rmo-search">
            <Search aria-hidden />
            <input
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setPage(1);
              }}
              placeholder="Search name, email or company"
              aria-label="Search people"
            />
          </label>
          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by role"
          >
            <option value="">All roles</option>
            {ROLES.map((code) => (
              <option key={code} value={code}>
                {ROLE_DEFINITIONS[code].label}
              </option>
            ))}
          </select>
          <ColumnPicker
            options={COLUMNS}
            value={columns}
            defaults={DEFAULTS}
            fixedLabel="Person"
            onChange={update}
          />
        </div>

        {users.isError ? (
          <div className="rmo-empty">
            <strong>Could not load people</strong>
            <span>{users.error.message}</span>
          </div>
        ) : !data ? (
          <div className="rmo-empty">Loading…</div>
        ) : !data.items.length ? (
          <div className="rmo-empty">
            <strong>No one matches</strong>
            <span>Try another search, role or status.</span>
          </div>
        ) : (
          <div className="rmo-table-scroll">
            <table className="rmo-table" aria-label="People">
              <thead>
                <tr>
                  <th>Person</th>
                  {show("roles") ? <th>Role</th> : null}
                  {show("team") ? <th>Team</th> : null}
                  {show("companies") ? <th>Companies</th> : null}
                  {show("lastLogin") ? <th>Last sign-in</th> : null}
                  {show("status") ? <th>Status</th> : null}
                  {show("created") ? <th>Created</th> : null}
                  {hasActions ? <th className="is-action">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => {
                  const state = statusOf(user);
                  const companies = user.spocClients?.length
                    ? user.spocClients.map((client) => client.displayName)
                    : user.client
                      ? [user.client.displayName]
                      : [];
                  return (
                    <tr key={user.id} aria-busy={busyIds.includes(user.id)}>
                      <td>
                        <div className="pd-person">
                          <span className="oa-avatar">{initials(user.displayName)}</span>
                          <span>
                            <strong>{user.displayName}</strong>
                            <small>{user.email}</small>
                          </span>
                        </div>
                      </td>
                      {show("roles") ? (
                        <td>
                          <div className="pd-chips">
                            {user.roles.map((entry) => (
                              <span
                                key={entry.customRole ?? entry.code}
                                className={`pd-chip ${entry.customRole ? "is-custom" : ""}`}
                              >
                                {entry.customRole ? <ShieldCheck aria-hidden /> : null}
                                {roleLabel(entry)}
                              </span>
                            ))}
                          </div>
                        </td>
                      ) : null}
                      {show("team") ? (
                        <td>
                          {user.teams?.length ? (
                            <div className="pd-chips">
                              {user.teams.map((team) => (
                                <span key={team.name} className="pd-chip is-team">
                                  {team.name}
                                  {team.lead ? <em>TL</em> : null}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="rmo-muted">—</span>
                          )}
                        </td>
                      ) : null}
                      {show("companies") ? (
                        <td className="pd-companies">
                          {companies.length ? (
                            companies.join(", ")
                          ) : (
                            <span className="rmo-muted">—</span>
                          )}
                        </td>
                      ) : null}
                      {show("lastLogin") ? (
                        <td className="whitespace-nowrap">{lastSeen(user.lastLoginAt)}</td>
                      ) : null}
                      {show("status") ? (
                        <td>
                          <span className={`rmo-pill ${state.tone}`}>{state.label}</span>
                        </td>
                      ) : null}
                      {show("created") ? (
                        <td className="whitespace-nowrap">{formatDateTime(user.createdAt)}</td>
                      ) : null}
                      {hasActions ? (
                        <td className="is-action">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Actions for ${user.displayName}`}
                              >
                                <MoreHorizontal aria-hidden />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 rounded-xl">
                              {actions?.onEditRoles ? (
                                <DropdownMenuItem onSelect={() => actions.onEditRoles!(user)}>
                                  Edit role &amp; access
                                </DropdownMenuItem>
                              ) : null}
                              {actions?.onViewActivity ? (
                                <DropdownMenuItem onSelect={() => actions.onViewActivity!(user)}>
                                  View activity
                                </DropdownMenuItem>
                              ) : null}
                              {actions?.onResetPassword ? (
                                <DropdownMenuItem onSelect={() => actions.onResetPassword!(user)}>
                                  Reset password
                                </DropdownMenuItem>
                              ) : null}
                              {actions?.onToggleStatus ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className={user.status === "SUSPENDED" ? "" : "text-red-600"}
                                    onSelect={() => actions.onToggleStatus!(user)}
                                  >
                                    {user.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="rmo-pager pd-pager">
          <span>{total ? `Showing ${from}–${to} of ${total}` : "No results"}</span>
          <div>
            <label className="pd-size">
              Rows
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                aria-label="Rows per page"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="pd-page">
              {page} / {pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
