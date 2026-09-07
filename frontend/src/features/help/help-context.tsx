import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import type { HelpWorkspace, PageGuide } from "./help-types";
import { loadPageGuide } from "./load-guide";
import { HelpContext } from "./help-state";

type ProviderProps = {
  workspace: HelpWorkspace;
  children: ReactNode;
  scope?: string;
  title?: string;
  purpose?: string;
};
export function PageHelpProvider({ workspace, scope = "public", ...props }: ProviderProps) {
  return (
    <HelpState
      key={scope + ":" + workspace}
      workspace={workspace}
      storageKey={"sapling:learning:v1:" + scope + ":" + workspace}
      {...props}
    />
  );
}

function HelpState({
  workspace,
  storageKey,
  children,
  title = "Your verification guide",
  purpose = "Understand this page and the next step in your verification workflow.",
}: ProviderProps & { storageKey: string }) {
  const path = useLocation({ select: (location) => location.pathname });
  const [preference, setPreference] = useState(false);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ path: string; guide: PageGuide } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    try {
      setPreference(
        (workspace === "candidate" ? sessionStorage : localStorage).getItem(storageKey) === "on",
      );
    } catch {
      /* Storage is optional; hints still work in memory. */
    }
  }, [workspace, storageKey]);
  useEffect(() => {
    if (!preference && !open) return;
    let cancelled = false;
    setError(false);
    void loadPageGuide(workspace, path, title, purpose)
      .then((guide) => {
        if (!cancelled) setResult({ path, guide });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [workspace, path, title, purpose, preference, open, attempt]);
  const setEnabled = (value: boolean) => {
    setPreference(value);
    try {
      (workspace === "candidate" ? sessionStorage : localStorage).setItem(
        storageKey,
        value ? "on" : "off",
      );
    } catch {
      /* Keep the visit's preference in memory. */
    }
  };
  return (
    <HelpContext.Provider
      value={{
        enabled: preference,
        setEnabled,
        open,
        setOpen,
        guide: result?.path === path ? result.guide : null,
        title,
        purpose,
        path,
        error,
        retry: () => setAttempt((value) => value + 1),
      }}
    >
      {children}
    </HelpContext.Provider>
  );
}
