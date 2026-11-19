import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, ChevronsLeft, ChevronsRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "sapling.sidebar.collapsed.v1";

/** Remembered sidebar state (desktop only), as in the Task app. */
function useCollapsed(enabled: boolean) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* Storage blocked: keep the sidebar open. */
    }
  }, [enabled]);
  const toggle = () =>
    setCollapsed((current) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, current ? "0" : "1");
      } catch {
        /* Session-only preference. */
      }
      return !current;
    });
  return { collapsed: enabled && collapsed, toggle };
}

/**
 * One frame for every workspace, laid out like the Task app: a full-width header whose
 * brand column lines up with the sidebar, the workspace name, search in the middle and
 * the tools and account on the right; the menu sits in a sidebar under the header.
 */
export function WorkspaceFrame({
  home,
  homeSearch,
  homeLabel,
  area,
  place,
  search,
  actions,
  navigation,
  navTitle,
  className,
  mainClassName,
  collapsible = false,
  children,
}: {
  home: string;
  homeSearch?: Record<string, string>;
  homeLabel: string;
  /** Small label above the organisation name, e.g. "Operations". */
  area: string;
  /** Organisation shown in the header, e.g. the company or tenant name. */
  place: string;
  search?: ReactNode;
  actions: ReactNode;
  /** The menu; `collapsed` is true when the desktop sidebar shows icons only. */
  navigation: (onNavigate?: () => void, collapsed?: boolean) => ReactNode;
  navTitle: string;
  className?: string;
  mainClassName?: string;
  /** Adds the Task-style "Collapse" control under the desktop sidebar. */
  collapsible?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { collapsed, toggle } = useCollapsed(collapsible);
  return (
    <div className={cn("min-h-screen bg-page text-ink", className)}>
      <a
        href="#workspace-main"
        className="fixed top-3 left-3 z-[100] -translate-y-24 rounded-md bg-surface px-3 py-2 text-sm font-semibold text-brand shadow focus:translate-y-0"
      >
        Skip to main content
      </a>
      <header className="client-topbar fixed inset-x-0 top-0 z-40 flex h-[60px] items-center gap-2 border-b border-line bg-surface/95 pr-3 pl-2 backdrop-blur sm:pr-5 xl:pl-0 in-[.theme-sky]:bg-white in-[.theme-sky]:backdrop-blur-none dark:in-[.theme-sky]:bg-surface">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 xl:hidden"
          aria-label="Open navigation"
          onClick={() => setOpen(true)}
        >
          <Menu aria-hidden />
        </Button>
        <Link
          to={home as "/admin"}
          search={homeSearch as never}
          aria-label={homeLabel}
          className={cn(
            "flex h-full min-w-0 shrink items-center xl:shrink-0 xl:border-r xl:border-line xl:px-5",
            collapsed ? "xl:w-auto" : "xl:w-[248px]",
          )}
        >
          <img
            src="/brand/sapling-wordmark.png"
            width={160}
            height={37}
            alt="Sapling Global"
            draggable={false}
            className="block h-auto w-[96px] select-none sm:w-[132px] xl:w-[160px] dark:[filter:invert(1)_hue-rotate(180deg)_saturate(1.4)_brightness(1.1)]"
          />
        </Link>
        <div className="hidden min-w-0 items-center gap-2.5 pl-3 lg:flex xl:pl-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-subtle text-dim">
            <Building2 className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-dim uppercase">{area}</p>
            <p className="max-w-[240px] truncate text-[15px] font-semibold text-ink">{place}</p>
          </div>
        </div>
        {search ? (
          <div className="client-global-search mx-auto hidden min-w-0 flex-1 px-3 md:block md:max-w-[460px]">
            {search}
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">{actions}</div>
      </header>

      <aside
        data-collapsed={collapsed || undefined}
        className={cn(
          "client-sidebar fixed bottom-0 left-0 top-[60px] z-30 hidden flex-col border-r border-line bg-surface xl:flex xl:transition-[width] xl:duration-200 in-[.theme-sky]:bg-white dark:in-[.theme-sky]:bg-surface",
          collapsed ? "w-[68px]" : "w-[248px]",
        )}
      >
        {navigation(undefined, collapsed)}
        {collapsible ? (
          <button
            type="button"
            onClick={toggle}
            aria-pressed={collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex shrink-0 items-center justify-center gap-2 border-t border-line py-2.5 text-xs font-medium text-dim hover:bg-subtle hover:text-ink"
          >
            {collapsed ? (
              <ChevronsRight className="size-4" aria-hidden />
            ) : (
              <>
                <ChevronsLeft className="size-4" aria-hidden /> Collapse
              </>
            )}
          </button>
        ) : null}
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="client-mobile-nav w-[288px] gap-0 bg-surface p-0 in-[.theme-sky]:bg-white dark:in-[.theme-sky]:bg-surface"
        >
          <SheetHeader className="flex h-[60px] shrink-0 justify-center border-b border-line px-5">
            <SheetTitle className="sr-only">{navTitle}</SheetTitle>
            <img
              src="/brand/sapling-wordmark.png"
              width={140}
              height={32}
              alt=""
              draggable={false}
              className="block h-auto w-[140px] select-none dark:[filter:invert(1)_hue-rotate(180deg)_saturate(1.4)_brightness(1.1)]"
            />
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col">{navigation(() => setOpen(false))}</div>
        </SheetContent>
      </Sheet>

      <div
        className={cn(
          "client-page min-w-0 pt-[60px] xl:transition-[padding] xl:duration-200",
          collapsed ? "xl:pl-[68px]" : "xl:pl-[248px]",
        )}
      >
        {search ? <div className="client-global-search px-4 pt-3 md:hidden">{search}</div> : null}
        <main id="workspace-main" className={mainClassName}>
          {children}
        </main>
      </div>
    </div>
  );
}
