import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { getSession } from "@/lib/api/auth";

/** Shown to the view-only Platform Admin: every page is readable, nothing is editable. */
export function ViewOnlyBanner() {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  if (!session.data?.viewOnly) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-[13px] text-sky-900"
      role="note"
    >
      <Eye className="size-4" aria-hidden />
      <strong>View-only oversight.</strong>
      <span>
        You can see every workspace. To push a case, open it and use <em>Escalate</em> — Operations
        handles it on high priority.
      </span>
    </div>
  );
}
