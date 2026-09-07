/** In-flight results belong to the session that started them, including body reads. */
export class ApiRequestScope {
  private generation = 0;
  private controller = new AbortController();

  get version() {
    return this.generation;
  }

  reset() {
    this.generation += 1;
    this.controller.abort(new DOMException("Session changed", "AbortError"));
    this.controller = new AbortController();
  }

  capture(callerSignal?: AbortSignal | null, timeoutMs = 30_000) {
    const generation = this.generation;
    const signals = [this.controller.signal, AbortSignal.timeout(timeoutMs)];
    if (callerSignal) signals.push(callerSignal);
    const signal = AbortSignal.any(signals);
    return {
      signal,
      assertCurrent: () => {
        signal.throwIfAborted();
        if (generation !== this.generation) {
          throw new DOMException("Session changed", "AbortError");
        }
      },
    };
  }
}
