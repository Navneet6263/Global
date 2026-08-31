const prefix = "sapling.public-link-token";

export function capturePublicLinkToken(resource: string): string {
  const key = `${prefix}:${resource}`;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const fragmentToken = params.get("token");
  if (fragmentToken) sessionStorage.setItem(key, fragmentToken);
  if (window.location.hash) {
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }
  return fragmentToken ?? sessionStorage.getItem(key) ?? "";
}

export function clearPublicLinkToken(resource: string) {
  sessionStorage.removeItem(`${prefix}:${resource}`);
}
