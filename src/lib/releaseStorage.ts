// Local-disk storage for uploaded release installers. No object storage
// (S3/R2/etc.) is configured for this project (confirmed 2026-09-30 —
// Namecheap shared hosting, no bucket credentials anywhere) — this module is
// the seam that isolates that decision: routes call these functions, never
// `fs` directly, so swapping to a remote backend later means replacing this
// file's implementation, not touching src/routes/adminReleases.ts or
// src/routes/portalReleases.ts.
//
// `storageKey` is intentionally an opaque string as far as callers are
// concerned (currently: a relative path under RELEASES_STORAGE_DIR).

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env";

function storageDir(): string {
  if (!env.releasesStorageDir) {
    throw new Error("RELEASES_STORAGE_DIR is not set — cannot store or read release files");
  }
  return env.releasesStorageDir;
}

/** Absolute path on disk for a given storage key. Never derived from anything client-supplied without going through generateStorageKey() first. */
export function resolveStoragePath(storageKey: string): string {
  return path.join(storageDir(), storageKey);
}

/**
 * A safe, collision-resistant filename for a new upload — never the
 * client-supplied original filename, which could contain path-traversal
 * sequences or collide with an existing file.
 */
export function generateStorageKey(product: string, version: string, originalName: string): string {
  const ext = path.extname(originalName).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 10);
  const unique = createHash("sha256").update(`${product}:${version}:${Date.now()}:${Math.random()}`).digest("hex").slice(0, 16);
  return `${product}-${version}-${unique}${ext}`;
}

export async function ensureStorageDirExists(): Promise<void> {
  await mkdir(storageDir(), { recursive: true });
}

/** Streams the file to compute its SHA-256 without loading it into memory. */
export function computeSha256(storageKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(resolveStoragePath(storageKey));
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

export async function getFileSize(storageKey: string): Promise<number> {
  const stats = await stat(resolveStoragePath(storageKey));
  return stats.size;
}

export function createFileReadStream(storageKey: string) {
  return createReadStream(resolveStoragePath(storageKey));
}

/** Best-effort delete — a release row being removable is the important guarantee, not this. Missing files are not an error. */
export async function deleteFile(storageKey: string): Promise<void> {
  try {
    await rm(resolveStoragePath(storageKey));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }
}
