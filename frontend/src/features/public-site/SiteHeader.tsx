import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Menu } from "lucide-react";
import { SaplingLogo } from "@/components/brand/sapling-logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const SECTIONS = [
  { href: "/#tour", label: "Product" },
  { href: "/#services", label: "Services" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#platform", label: "Platform" },
  { href: "/#security", label: "Security" },
  { href: "/#faq", label: "FAQ" },
];

/** Public header: landing sections plus sign-in / sign-up. */
export function SiteHeader({ page = "home" }: { page?: "home" | "signin" | "signup" }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="site-wrap site-header-row">
        <Link to="/" aria-label="Sapling Global home" className="shrink-0">
          <SaplingLogo width={148} />
        </Link>
        {page === "home" ? (
          <nav aria-label="Sections">
            {SECTIONS.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        ) : null}
        <div className="site-header-actions">
          {page === "home" ? (
            <Link to="/auth" className="site-btn is-ghost site-hide-sm">
              Sign in
            </Link>
          ) : null}
          {page !== "signup" ? (
            <Link to="/signup" className="site-btn is-primary">
              Get started <ArrowRight aria-hidden />
            </Link>
          ) : (
            <Link to="/auth" className="site-btn is-outline">
              Sign in
            </Link>
          )}
          {page === "home" ? (
            <button
              type="button"
              className="site-menu-button"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-5" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[300px]">
          <SheetHeader>
            <SheetTitle>
              <SaplingLogo width={130} />
            </SheetTitle>
          </SheetHeader>
          <nav className="site-mobile-nav px-4" aria-label="Sections">
            {SECTIONS.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </a>
            ))}
            <Link to="/auth" onClick={() => setOpen(false)}>
              Sign in
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
