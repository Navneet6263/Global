/** Open during the click, before fetching, so browsers do not block the new tab. */
export async function openDocumentPreview(load: () => Promise<Blob>): Promise<void> {
  const tab = window.open("about:blank", "_blank");
  if (!tab) throw new Error("Allow pop-ups for this site to preview documents in a new tab.");

  let objectUrl: string | undefined;
  try {
    tab.opener = null;
    tab.document.title = "Document preview · Sapling Global";
    tab.document.body.textContent = "Opening secure document preview…";
    const blob = await load();
    if (tab.closed) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(blob.type)) {
      throw new Error("This file cannot be previewed. Use Download for the original file.");
    }
    objectUrl = URL.createObjectURL(blob);
    tab.location.replace(objectUrl);

    // Keep the URL alive while the viewer is open (PDF viewers load pages lazily).
    // Release document bytes when its tab closes or the source page is left.
    const url = objectUrl;
    const release = () => {
      URL.revokeObjectURL(url);
      window.clearInterval(timer);
      window.removeEventListener("pagehide", release);
    };
    const timer = window.setInterval(() => {
      if (tab.closed) release();
    }, 1_000);
    window.addEventListener("pagehide", release, { once: true });
  } catch (error) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    tab.close();
    throw error;
  }
}
