import { lazy, Suspense, useState } from "react";
import { BookOpen, ChevronDown, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePageHelp } from "./help-state";
import { useHydrated } from "@/lib/use-hydrated";

const HelpConversation = lazy(() => import("./help-conversation"));

export function HelpLauncher({
  label = "Help",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const hydrated = useHydrated();
  const help = usePageHelp();
  if (!help) return null;
  return (
    <Sheet open={help.open} onOpenChange={help.setOpen}>
      <SheetTrigger asChild>
        <Button
          variant={label === "Help" ? "ghost" : "outline"}
          size="sm"
          className={
            className ??
            (label === "Help"
              ? "gap-1.5 rounded-full"
              : "h-10 gap-2 rounded-lg bg-white text-primary shadow-none")
          }
          aria-label="Help with this page"
          disabled={!hydrated}
        >
          <CircleHelp className="size-4" aria-hidden />
          <span className="hidden sm:inline">{label}</span>
          {help.enabled ? (
            <span className="size-1.5 rounded-full bg-good" aria-label="Learning mode on" />
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[450px]">
        <SheetHeader className="shrink-0 border-b px-5 pt-6 pb-4 text-left">
          <span className="mb-1 flex items-center gap-2 text-xs font-medium text-good">
            <BookOpen className="size-4" aria-hidden /> Sapling page guide
          </span>
          <SheetTitle className="pr-7">{help.guide?.title ?? help.title}</SheetTitle>
          <SheetDescription>
            Page-specific guidance. No actions are taken on your behalf.
          </SheetDescription>
        </SheetHeader>
        {help.open ? (
          <Suspense
            fallback={
              <p role="status" className="p-5 text-sm text-muted-foreground">
                Loading the page guide…
              </p>
            }
          >
            <HelpConversation key={help.path} />
          </Suspense>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function LearningIntro() {
  const help = usePageHelp();
  if (!help?.enabled) return null;
  return (
    <section
      aria-label="Page learning guide"
      className="flex items-start gap-3 rounded-2xl border border-good/25 bg-good-soft px-4 py-3"
    >
      <BookOpen className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink">Learning mode · {help.title}</p>
        <p className="mt-1 text-xs leading-5 text-foreground/75">
          {help.guide?.purpose ?? help.purpose}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 text-xs"
        onClick={() => help.setOpen(true)}
      >
        Show steps
      </Button>
    </section>
  );
}

/**
 * One Help control for the header: a single "Help" button whose panel opens this page's
 * guide or switches learning mode on/off (replaces separate Help and Learn buttons).
 */
export function HelpMenu() {
  const hydrated = useHydrated();
  const help = usePageHelp();
  const [open, setOpen] = useState(false);
  if (!help) return null;
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-[13px] font-semibold text-ink hover:border-brand/40 hover:text-brand sm:px-3"
            aria-label="Help menu"
            disabled={!hydrated}
          >
            <CircleHelp className="size-4" aria-hidden />
            <span className="hidden sm:inline">Help</span>
            {help.enabled ? (
              <i className="size-[7px] rounded-full bg-good" aria-label="Learning mode on" />
            ) : null}
            <ChevronDown aria-hidden className="hidden size-3.5 text-dim sm:block" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 rounded-xl p-1.5">
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left [&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:text-brand hover:bg-subtle"
            aria-label="Help with this page"
            onClick={() => {
              setOpen(false);
              help.setOpen(true);
            }}
          >
            <CircleHelp aria-hidden />
            <span className="grid min-w-0 flex-1">
              <strong className="text-[13px] text-ink">Help with this page</strong>
              <small className="text-[11.5px] text-dim">
                What this page is for and how to use it
              </small>
            </span>
          </button>
          <div className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left [&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:text-brand">
            <BookOpen aria-hidden />
            <span className="grid min-w-0 flex-1">
              <strong className="text-[13px] text-ink">Learning mode</strong>
              <small className="text-[11.5px] text-dim">
                Show a short guide at the top of every page
              </small>
            </span>
            <button
              type="button"
              role="switch"
              aria-label="Learning mode"
              aria-checked={help.enabled}
              className={`relative h-4 w-7 shrink-0 cursor-pointer rounded-full p-0.5 transition ${help.enabled ? "bg-brand" : "bg-line"}`}
              data-enabled={help.enabled}
              onClick={() => help.setEnabled(!help.enabled)}
            >
              <span
                className={`block size-3 rounded-full bg-surface shadow transition-transform ${help.enabled ? "translate-x-3" : ""}`}
              />
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <Sheet open={help.open} onOpenChange={help.setOpen}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[450px]">
          <SheetHeader className="shrink-0 border-b px-5 pt-6 pb-4 text-left">
            <span className="mb-1 flex items-center gap-2 text-xs font-medium text-good">
              <BookOpen className="size-4" aria-hidden /> Sapling page guide
            </span>
            <SheetTitle className="pr-7">{help.guide?.title ?? help.title}</SheetTitle>
            <SheetDescription>
              Page-specific guidance. No actions are taken on your behalf.
            </SheetDescription>
          </SheetHeader>
          {help.open ? (
            <Suspense
              fallback={
                <p role="status" className="p-5 text-sm text-muted-foreground">
                  Loading the page guide…
                </p>
              }
            >
              <HelpConversation key={help.path} />
            </Suspense>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
