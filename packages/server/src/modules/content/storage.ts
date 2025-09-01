import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const cfg = {
  localDir: process.env.LOCAL_UPLOAD_DIR ?? "./uploads",
  baseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:4000",
};

export function newStorageKey(filename: string) {
  const ext = filename.includes(".") ? filename.split(".").pop() : "";
  const id = crypto.randomUUID();
  const y = new Date().getFullYear();
  const m = String(new Date().getMonth() + 1).padStart(2, "0");
  return `notes/${y}/${m}/${id}${ext ? "." + ext : ""}`;
}

export async function presignPut(storageKey: string, _mime: string, _sizeBytes: number) {
  // For local disk, we return an internal upload endpoint.
  return {
    url: `${cfg.baseUrl}/api/content/local-upload/${encodeURIComponent(storageKey)}`,
    method: "POST",
    headers: {}
  };
}

export async function verifyExists(storageKey: string) {
  try {
    await fs.stat(path.join(cfg.localDir, storageKey));
    return true;
  } catch {
    return false;
  }
}

export async function presignGet(storageKey: string, filename: string) {
  return {
    url: `${cfg.baseUrl}/api/content/local-download/${encodeURIComponent(storageKey)}?filename=${encodeURIComponent(filename)}`
  };
}