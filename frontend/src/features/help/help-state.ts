import { createContext, useContext } from "react";
import type { PageGuide } from "./help-types";

export type HelpContextValue = {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  open: boolean;
  setOpen: (value: boolean) => void;
  guide: PageGuide | null;
  title: string;
  purpose: string;
  path: string;
  error: boolean;
  retry: () => void;
};
export const HelpContext = createContext<HelpContextValue | null>(null);
export const usePageHelp = () => useContext(HelpContext);
