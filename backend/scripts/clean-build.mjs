import { lstat, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backendDirectory = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = resolve(backendDirectory, "dist");

/** Clean only generated output. Never follow a redirected dist folder or ignore failure. */
export async function cleanBuildOutput(filesystem = { lstat, rm }) {
  if (
    dirname(outputDirectory) !== resolve(backendDirectory) ||
    basename(outputDirectory) !== "dist"
  ) {
    throw new Error("Refusing to clean a directory outside backend/dist.");
  }
  try {
    const entry = await filesystem.lstat(outputDirectory);
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      throw new Error(
        "backend/dist must be a normal generated directory, not a file or directory link.",
      );
    }
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  try {
    // Node retries transient Windows directory locks; Nest's default cleanup does not.
    await filesystem.rm(outputDirectory, {
      recursive: true,
      force: true,
      maxRetries: 6,
      retryDelay: 200,
    });
  } catch (error) {
    if (["EPERM", "EACCES", "EBUSY", "ENOTEMPTY"].includes(error.code)) {
      throw new Error(
        `Cannot clean ${outputDirectory} (${error.code}). Close any other Sapling backend watch/build ` +
          "and terminals opened inside dist, then retry. No source files or database records were removed. " +
          "If the lock remains, check Windows file access or antivirus; do not disable protection globally.",
        { cause: error },
      );
    }
    throw error;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  cleanBuildOutput().catch((error) => {
    console.error(`[build cleanup] ${error.message}`);
    process.exitCode = 1;
  });
}
