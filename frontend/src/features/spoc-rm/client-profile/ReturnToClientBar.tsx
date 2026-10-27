import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ArrowLeft, Building2, X } from "lucide-react";
import { clearClientReturn, readClientReturn, type ClientReturn } from "./client-return";

/**
 * Shown on RM pages the RM opened from a client's profile: one click takes them back to
 * that client. Hidden on the profile itself and once dismissed.
 */
export function ReturnToClientBar() {
  const { pathname } = useLocation();
  const [client, setClient] = useState<ClientReturn | null>(null);
  useEffect(() => setClient(readClientReturn()), [pathname]);
  if (!client || pathname.startsWith(`/spoc-rm/clients/${client.id}`)) return null;
  return (
    <div
      role="navigation"
      aria-label="Back to client"
      className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-[13px] text-blue-900"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Building2 className="size-4 shrink-0" aria-hidden />
        <span className="truncate">
          Working for <strong>{client.name}</strong>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <Link
          to="/spoc-rm/clients/$clientId"
          params={{ clientId: client.id }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-blue-700"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Back to {client.name}
        </Link>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            clearClientReturn();
            setClient(null);
          }}
          className="grid size-8 place-items-center rounded-lg text-blue-700 hover:bg-blue-100"
        >
          <X className="size-4" aria-hidden />
        </button>
      </span>
    </div>
  );
}
