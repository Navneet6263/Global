import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

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
  navigation: (onNavigate?: () => void) => ReactNode;
  navTitle: string;
  className?: string;
  mainClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("min-h-screen bg-[#f6f8fb] text-slate-900", className)}>
      <a href="#workspace-main" className="client-skip-link">
        Skip to main content
      </a>
      <header className="client-topbar fixed inset-x-0 top-0 z-40 flex h-[60px] items-center gap-2 border-b border-slate-200 bg-white/95 pr-3 pl-2 backdrop-blur sm:pr-5 xl:pl-0">
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
          className="flex h-full min-w-0 shrink items-center xl:w-[248px] xl:shrink-0 xl:border-r xl:border-slate-200 xl:px-5"
        >
          <img
            src="/brand/sapling-wordmark.png"
            width={160}
            height={37}
            alt="Sapling Global"
            draggable={false}
            className="block h-auto w-[96px] select-none sm:w-[132px] xl:w-[160px]"
          />
        </Link>
        <div className="hidden min-w-0 items-center gap-2.5 pl-3 lg:flex xl:pl-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
            <Building2 className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
              {area}
            </p>
            <p className="max-w-[240px] truncate text-[15px] font-semibold text-slate-900">
              {place}
            </p>
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

      <aside className="client-sidebar fixed bottom-0 left-0 top-[60px] z-30 hidden w-[248px] flex-col border-r border-slate-200 bg-white xl:flex">
        {navigation()}
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="client-mobile-nav w-[288px] gap-0 bg-white p-0">
          <SheetHeader className="flex h-[60px] shrink-0 justify-center border-b border-slate-200 px-5">
            <SheetTitle className="sr-only">{navTitle}</SheetTitle>
            <img
              src="/brand/sapling-wordmark.png"
              width={140}
              height={32}
              alt=""
              draggable={false}
              className="block h-auto w-[140px] select-none"
            />
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col">{navigation(() => setOpen(false))}</div>
        </SheetContent>
      </Sheet>

      <div className="client-page min-w-0 pt-[60px] xl:pl-[248px]">
        {search ? <div className="client-global-search px-4 pt-3 md:hidden">{search}</div> : null}
        <main id="workspace-main" className={mainClassName}>
          {children}
        </main>
      </div>
    </div>
  );
}
