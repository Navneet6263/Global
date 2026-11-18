export async function fileSha256(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function filesSha256(files: Blob[]): Promise<string> {
  if (files.length === 0) {
    return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  }
  if (files.length === 1) {
    return fileSha256(files[0]!);
  }
  const hashes = await Promise.all(files.map((f) => fileSha256(f)));
  const combined = new TextEncoder().encode(hashes.join(":"));
  const digest = await crypto.subtle.digest("SHA-256", combined);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
