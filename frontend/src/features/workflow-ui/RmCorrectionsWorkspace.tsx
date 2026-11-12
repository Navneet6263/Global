import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SharedL1ClarificationsPanel } from "@/features/clarifications/SharedL1ClarificationsPanel";
import { SharedL2ClarificationsPanel } from "@/features/clarifications/SharedL2ClarificationsPanel";
import { resolveCorrectionTab, type RmCorrectionTab } from "./rm-queue-model";

const TAB_ITEMS: ReadonlyArray<{ value: RmCorrectionTab; label: string }> = [
  { value: "cases", label: "Correction Cases" },
  { value: "l2", label: "L2 Document Clarifications" },
  { value: "l1", label: "L1 Threads" },
];

/**
 * Unified SPOC-RM Corrections & Queries workspace.
 * Combines Correction Cases, Shared L2 Document Clarifications, and Shared L1 Threads
 * under accessible segmented tabs so only the active work area renders at a time.
 */
export function RmCorrectionsWorkspace({
  activeTab: rawTab,
  correctionCasesCount,
  onTabChange,
  casesView,
}: {
  activeTab?: RmCorrectionTab;
  correctionCasesCount?: number;
  onTabChange: (tab: RmCorrectionTab) => void;
  casesView: ReactNode;
}) {
  const activeTab = resolveCorrectionTab(rawTab);

  return (
    <section className="rmo-card rmo-queue" aria-label="Corrections & Queries workspace">
      <Tabs value={activeTab} onValueChange={(next) => onTabChange(resolveCorrectionTab(next))}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-[18px] py-3.5">
          <div>
            <h2 className="text-[18px] font-bold text-slate-900">Corrections &amp; Queries</h2>
            <p className="text-[12.5px] text-slate-500">
              Review correction cases, L2 document clarifications, and L1 threads in one workspace.
            </p>
          </div>
          <TabsList
            aria-label="Corrections workspace sections"
            className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto"
          >
            {TAB_ITEMS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
              >
                <span>{tab.label}</span>
                {tab.value === "cases" && correctionCasesCount !== undefined ? (
                  <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                    {correctionCasesCount}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </header>

        <TabsContent value="cases" className="mt-0">
          {activeTab === "cases" ? casesView : null}
        </TabsContent>
        <TabsContent value="l2" className="mt-0">
          {activeTab === "l2" ? <SharedL2ClarificationsPanel mode="rm" embedded /> : null}
        </TabsContent>
        <TabsContent value="l1" className="mt-0">
          {activeTab === "l1" ? <SharedL1ClarificationsPanel mode="rm" embedded /> : null}
        </TabsContent>
      </Tabs>
    </section>
  );
}
