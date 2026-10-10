import { useState } from "react";
import { Building2, ClipboardList, LayoutDashboard, Rocket } from "lucide-react";
import { GlassDashboard, type GlassVariant } from "./GlassDashboard";

const TABS = [
  {
    id: "ops",
    label: "Operations",
    icon: LayoutDashboard,
    title: "Every case, owner and deadline at a glance",
    copy: "Your verification team sees live counts, the work queue due-first and who is holding each case.",
    variant: "operations" as GlassVariant,
  },
  {
    id: "client",
    label: "Client portal",
    icon: Building2,
    title: "Your HR team always knows where things stand",
    copy: "Start verifications, see what needs your action and download reports — without emails back and forth.",
    variant: "client" as GlassVariant,
  },
  {
    id: "rm",
    label: "RM workspace",
    icon: ClipboardList,
    title: "A dedicated RM moves every case forward",
    copy: "Cases grouped by step: data entry, routing to specialist teams and final approval before release.",
    variant: "rm" as GlassVariant,
  },
  {
    id: "onboarding",
    label: "Onboarding",
    icon: Rocket,
    title: "Go live with a guided checklist",
    copy: "Company details, agreements and KYC in one place, with progress and your RM's notes as you go.",
    variant: "onboarding" as GlassVariant,
  },
] as const;

/** Tabbed tour of the product, drawn as glass illustrations with sample data. */
export function ProductTour() {
  const [active, setActive] = useState<(typeof TABS)[number]["id"]>("ops");
  const tab = TABS.find((item) => item.id === active)!;
  return (
    <div className="tour">
      <div className="tour-tabs" role="tablist" aria-label="Product screens">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tour-${item.id}`}
            aria-selected={item.id === active}
            aria-controls="tour-panel"
            onClick={() => setActive(item.id)}
          >
            <item.icon aria-hidden />
            {item.label}
          </button>
        ))}
      </div>
      <div
        id="tour-panel"
        role="tabpanel"
        aria-labelledby={`tour-${tab.id}`}
        className="tour-panel"
      >
        <div className="tour-copy">
          <h3>{tab.title}</h3>
          <p>{tab.copy}</p>
        </div>
        <div className="mx-auto max-w-4xl px-4 pb-10 sm:px-10">
          <GlassDashboard
            key={tab.id}
            variant={tab.variant}
            label={`${tab.label} screen (illustration)`}
            className="tour-frame"
          />
        </div>
      </div>
    </div>
  );
}
