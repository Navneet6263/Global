import { lazy, Suspense } from "react";
import { BookOpen, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { usePageHelp } from "./help-state";
import { useHydrated } from "@/lib/use-hydrated";

const HelpConversation = lazy(() => import("./help-conversation"));

export function HelpLauncher() {
  const hydrated = useHydrated();
  const help = usePageHelp();
  if (!help) return null;
  return (
    <Sheet open={help.open} onOpenChange={help.setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 rounded-full"
          aria-label="Help with this page"
          disabled={!hydrated}
        >
          <CircleHelp className="size-4" aria-hidden />
          <span className="hidden sm:inline">Help</span>
          {help.enabled ? (
            <span className="size-1.5 rounded-full bg-emerald-600" aria-label="Learning mode on" />
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[450px]">
        <SheetHeader className="shrink-0 border-b px-5 pt-6 pb-4 text-left">
          <span className="mb-1 flex items-center gap-2 text-xs font-medium text-emerald-800">
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
      className="flex items-start gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3"
    >
      <BookOpen className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-emerald-900">Learning mode · {help.title}</p>
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
