export type RequestActivityKind = "write" | "upload" | "download";
export type RequestActivitySnapshot = Readonly<Record<RequestActivityKind, number>>;
export const idleRequestActivity: RequestActivitySnapshot = Object.freeze({
  write: 0,
  upload: 0,
  download: 0,
});

/** Counts foreground work only. No URLs, files, credentials or response data are retained. */
export class RequestActivity {
  private snapshot = idleRequestActivity;
  private listeners = new Set<() => void>();
  private generation = 0;

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  start(kind: RequestActivityKind) {
    const generation = this.generation;
    this.update({ ...this.snapshot, [kind]: this.snapshot[kind] + 1 });
    let finished = false;
    return () => {
      if (finished || generation !== this.generation) return;
      finished = true;
      this.update({ ...this.snapshot, [kind]: Math.max(0, this.snapshot[kind] - 1) });
    };
  }
  reset() {
    this.generation++;
    this.update(idleRequestActivity);
  }
  private update(snapshot: RequestActivitySnapshot) {
    this.snapshot = Object.freeze(snapshot);
    this.listeners.forEach((listener) => listener());
  }
}

export const requestActivity = new RequestActivity();
export function beginRequestActivity(kind: RequestActivityKind) {
  // SSR must never share one visitor's in-flight activity with another visitor.
  return typeof window === "undefined" ? () => undefined : requestActivity.start(kind);
}
