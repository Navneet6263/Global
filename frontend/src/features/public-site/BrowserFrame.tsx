import { LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";

/** A product screenshot in a light browser window, SaaS-landing style. */
export function BrowserFrame({
  src,
  alt,
  url = "app.saplingglobal.in",
  className,
  eager = false,
}: {
  src: string;
  alt: string;
  url?: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    <figure className={cn("browser-frame", className)}>
      <div className="browser-bar" aria-hidden>
        <span className="browser-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="browser-url">
          <LockKeyhole />
          {url}
        </span>
      </div>
      <img
        src={src}
        alt={alt}
        width={2160}
        height={1350}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
    </figure>
  );
}
