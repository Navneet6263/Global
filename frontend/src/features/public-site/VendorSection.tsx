import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  FileCheck2,
  Hand,
  IndianRupee,
  ListTodo,
  MapPin,
  ReceiptIndianRupee,
  ShieldCheck,
  Truck,
  UsersRound,
} from "lucide-react";

const STEPS = [
  {
    icon: ShieldCheck,
    title: "Sign up and get approved",
    copy: "Register your business and upload one document — company PAN, GST certificate or registration. Our Operations team approves you.",
  },
  {
    icon: ListTodo,
    title: "See the work before you take it",
    copy: "The open queue shows the check type, city, pincode, payment and due date. Candidate details open only after you pick.",
  },
  {
    icon: UsersRound,
    title: "Pick it and work as a team",
    copy: "First to pick gets it. Your Team Leader hands checks to members and reviews their work before it reaches us.",
  },
  {
    icon: ReceiptIndianRupee,
    title: "Submit proof, claim extra cost",
    copy: "Upload photos and records with your result. Travelled further than planned? Add the extra cost with a reason for approval.",
  },
];

const PROMISES = [
  "Payment shown upfront",
  "Can't do it? Return it to the queue",
  "Every step recorded",
];

const SAMPLE = [
  { type: "Address", place: "Lucknow · 226010", pay: "450", due: "Due 25 Nov" },
  { type: "Court record", place: "Pune · 411001", pay: "300", due: "Due 27 Nov" },
  { type: "Criminal", place: "Jaipur · 302001", pay: "350", due: "Due 28 Nov" },
];

/** Landing section for verification vendors: how the open queue works for them. */
export function VendorSection() {
  return (
    <section id="vendors" className="site-section is-tint" aria-labelledby="vendors-title">
      <div className="site-wrap">
        <div className="site-section-head">
          <span className="site-kicker">For vendors</span>
          <h2 id="vendors-title" className="site-h2">
            Verification work for vendors, made simple
          </h2>
          <p>
            Address, court and criminal checks from verified companies. Pick the work that suits
            you, see the payment before you start, and track every check in one place.
          </p>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <ol className="grid gap-3 sm:grid-cols-2" aria-label="How it works for vendors">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04)]"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                    <step.icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-[12px] font-semibold tracking-wide text-slate-400 uppercase">
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="mt-3 text-[16px] font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1.5 text-[14px] leading-6 text-slate-600">{step.copy}</p>
              </li>
            ))}
          </ol>

          <div className="grid gap-4">
            <QueuePreview />

            <ul className="flex flex-wrap gap-2" aria-label="What vendors get">
              {PROMISES.map((text) => (
                <li
                  key={text}
                  className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[13px] font-medium text-emerald-800"
                >
                  <BadgeCheck className="size-4 text-emerald-600" aria-hidden /> {text}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-3">
              <Link to="/vendor/signup" className="site-btn is-primary is-lg">
                Sign up as a vendor <ArrowRight aria-hidden />
              </Link>
              <Link to="/auth" className="site-btn is-outline is-lg">
                Vendor sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** A small "Open queue" picture (illustration only): checks with city, due date and payment. */
export function QueuePreview({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-[0_24px_60px_-30px_rgb(15_23_42/0.35)] backdrop-blur ${className}`}
      aria-label="Open queue (illustration)"
      role="img"
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-slate-900">
          <ListTodo className="size-4 text-blue-700" aria-hidden /> Open queue
        </span>
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[12px] font-semibold text-blue-700">
          3 waiting
        </span>
      </div>
      <ul className="grid gap-2.5" aria-hidden>
        {SAMPLE.map((item) => (
          <li
            key={item.type}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-3.5 py-3"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-slate-500 shadow-sm">
              <Truck className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-slate-900">{item.type}</span>
              <span className="flex flex-wrap items-center gap-x-3 text-[12px] text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" /> {item.place}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarClock className="size-3" /> {item.due}
                </span>
              </span>
            </span>
            <span className="flex items-center gap-0.5 rounded-lg bg-emerald-50 px-2 py-1 text-[14px] font-semibold text-emerald-700">
              <IndianRupee className="size-3.5" />
              {item.pay}
            </span>
            <span className="hidden items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[12px] font-semibold text-white sm:flex">
              <Hand className="size-3.5" /> Pick
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 px-1 text-[12px] text-slate-500">
        <FileCheck2 className="size-3.5" aria-hidden />
        Documents and candidate details open after you pick.
      </p>
    </div>
  );
}
