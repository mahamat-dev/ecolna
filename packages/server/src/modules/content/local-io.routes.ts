import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";

const local = Router();
const base = process.env.LOCAL_UPLOAD_DIR ?? "./uploads";

async function ensureDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

local.post("/local-upload/:key", async (req, res) => {
  try {
    const filePath = path.join(base, req.params.key);
    await ensureDir(filePath);
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    await fs.writeFile(filePath, Buffer.concat(chunks));
    res.json({ ok: true });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: { code: "UPLOAD_FAILED", message: "Failed to upload file" } });
  }
});

local.get("/local-download/:key", async (req, res) => {
  try {
    const filePath = path.join(base, req.params.key);
    const filename = (req.query.filename as string) || "download";
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.sendFile(filePath, { root: process.cwd() }, (err) => {
      if (err) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "File not found" } });
      }
    });
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: { code: "DOWNLOAD_FAILED", message: "Failed to download file" } });
  }
});

export default local;