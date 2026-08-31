export async function purgePrivateAppShell(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/").catch(() => undefined);
  const worker = navigator.serviceWorker.controller ?? registration?.active;
  worker?.postMessage({ type: "PURGE_PRIVATE_CACHE" });
}
