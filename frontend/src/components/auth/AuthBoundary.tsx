import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { getSession } from "@/lib/api/auth";
import { canAccessWorkspace, homeForSession } from "@/lib/auth/workspace-access";

export function AuthBoundary({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isLogin = pathname === "/login";
  const isPublic =
    isLogin ||
    pathname.startsWith("/consent/") ||
    pathname.startsWith("/clarification/") ||
    pathname.startsWith("/candidate/") ||
    pathname.startsWith("/reports/verify/");
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    enabled: typeof window !== "undefined" && !isPublic,
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!isPublic && session.data?.mustChangePassword && pathname !== "/change-password") {
      window.location.replace("/change-password");
    }
  }, [isPublic, pathname, session.data]);

  useEffect(() => {
    if (!isPublic && session.isError) {
      const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      window.location.replace(`/login?returnTo=${returnTo}`);
    }
  }, [isPublic, session.isError]);

  useEffect(() => {
    if (!isPublic && session.data && !canAccessWorkspace(session.data, pathname)) {
      window.location.replace(homeForSession(session.data));
    }
  }, [isPublic, pathname, session.data]);

  if (isPublic) return children;
  if (
    session.data &&
    (pathname === "/change-password" ||
      (!session.data.mustChangePassword && canAccessWorkspace(session.data, pathname)))
  )
    return children;
  return (
    <div className="grid min-h-screen place-items-center bg-[#f3f4f5] px-6">
      <div className="flex items-center gap-3 rounded-3xl bg-white px-6 py-5 shadow-sm ring-1 ring-black/5">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#111214] text-[#adf43b]">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[#111214]">Securing your workspace</p>
          <p className="mt-0.5 text-xs text-[#73777f]">Checking session and access scope…</p>
        </div>
      </div>
    </div>
  );
}
