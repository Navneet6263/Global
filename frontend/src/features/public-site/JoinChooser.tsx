import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Truck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * "Get started" asks first: register a company (needs verifications) or a vendor
 * (does verification work), then opens the matching sign-up.
 */
export function JoinChooser({ className, children }: { className: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-6 sm:p-7">
          <DialogHeader>
            <DialogTitle className="text-[22px] font-semibold tracking-tight text-slate-900">
              How would you like to join?
            </DialogTitle>
            <DialogDescription className="text-[14px] text-slate-500">
              Choose one to start the sign-up. It takes a few minutes.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Choice
              to="/signup"
              onPick={() => setOpen(false)}
              icon={<Building2 className="size-5" aria-hidden />}
              tone="bg-blue-50 text-blue-700"
              title="Register a company"
              who="I need employee verifications"
              detail="Start background checks for your hires, track every case live and download reports."
            />
            <Choice
              to="/vendor/signup"
              onPick={() => setOpen(false)}
              icon={<Truck className="size-5" aria-hidden />}
              tone="bg-emerald-50 text-emerald-700"
              title="Register as a vendor"
              who="I do verification work"
              detail="Pick address, court and criminal checks near you and get paid for every check."
            />
          </div>
          <p className="mt-1 text-center text-[13px] text-slate-500">
            Already have an account?{" "}
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className="font-semibold text-blue-700 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Choice({
  to,
  onPick,
  icon,
  tone,
  title,
  who,
  detail,
}: {
  to: "/signup" | "/vendor/signup";
  onPick: () => void;
  icon: ReactNode;
  tone: string;
  title: string;
  who: string;
  detail: string;
}) {
  return (
    <Link
      to={to}
      onClick={onPick}
      className="group flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 no-underline transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_14px_30px_-18px_rgb(29_78_216/0.5)]"
    >
      <span className="flex items-center justify-between">
        <span className={`grid size-11 place-items-center rounded-xl ${tone}`}>{icon}</span>
        <ArrowRight
          className="size-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-700"
          aria-hidden
        />
      </span>
      <span>
        <strong className="block text-[16px] font-semibold text-slate-900">{title}</strong>
        <span className="text-[13px] font-medium text-slate-500">{who}</span>
      </span>
      <span className="text-[13px] leading-5 text-slate-600">{detail}</span>
    </Link>
  );
}
