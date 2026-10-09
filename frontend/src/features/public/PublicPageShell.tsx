import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { SaplingLogo } from "@/components/brand/sapling-logo";
import { PageHelpProvider } from "@/features/help/help-context";
import { HelpLauncher, LearningIntro } from "@/features/help/help-launcher";

export function PublicPageShell({
  context,
  children,
  width = "wide",
  actions,
}: {
  context: string;
  children: ReactNode;
  width?: "compact" | "wide";
  /** Page-specific header buttons (the candidate page adds Support). */
  actions?: ReactNode;
}) {
  return (
    <PageHelpProvider workspace="candidate">
      <main className="min-h-screen bg-transparent px-3 py-3 text-foreground sm:px-5 sm:py-5">
        <div
          className={`mx-auto flex min-h-[calc(100vh-1.5rem)] flex-col ${width === "compact" ? "max-w-3xl" : "max-w-5xl"}`}
        >
          <header className="surface flex items-center justify-between gap-3 rounded-[1.5rem] px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0">
                <SaplingLogo width={140} />
                <p className="mt-1 truncate pl-0.5 text-[11px] text-muted-foreground">{context}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {actions}
              <HelpLauncher />
              <div className="flex shrink-0 items-center gap-2 rounded-full bg-mint-soft px-3 py-2 text-[10px] font-semibold text-mint-deep">
                <ShieldCheck className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">Protected access</span>
                <span className="sm:hidden">Secure</span>
              </div>
            </div>
          </header>

          <div className="flex-1 space-y-4 py-4 sm:py-6">
            <LearningIntro />
            {children}
          </div>

          <footer className="flex flex-col items-center justify-between gap-2 px-3 py-3 text-center text-[10px] leading-5 text-muted-foreground sm:flex-row sm:text-left">
            <p>Access is limited to the verification request linked to this page.</p>
            <p className="flex items-center gap-1.5">
              <ShieldCheck className="size-3" /> Sapling Global secure verification
            </p>
          </footer>
        </div>
      </main>
    </PageHelpProvider>
  );
}
