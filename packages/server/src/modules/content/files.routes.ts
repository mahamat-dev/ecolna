import { Router } from "express";
import { z } from "zod";
import { db } from "../../db/client";
import { fileObject } from "../../db/schema/content";
import { PresignUploadDto, CommitUploadDto } from "./dto";
import { newStorageKey, presignPut, presignGet, verifyExists } from "./storage";
import { requireAuth } from "../../middlewares/rbac";
import { writeAudit, actorFromReq } from "../admin-utils/audit.service";
import localIO from "./local-io.routes";
import { eq } from "drizzle-orm";

export const filesRouter = Router();
filesRouter.use(requireAuth);
filesRouter.use(localIO); // Enables /local-upload and /local-download

filesRouter.post("/files/presign", async (req, res, next) => {
  try {
    const dto = PresignUploadDto.parse(req.body);
    const storageKey = newStorageKey(dto.filename);
    const presigned = await presignPut(storageKey, dto.mime, dto.sizeBytes);

    const rows = await db.insert(fileObject).values({
      storageKey,
      filename: dto.filename,
      mime: dto.mime,
      sizeBytes: dto.sizeBytes,
      sha256: dto.sha256 ?? null,
      status: "PENDING",
      uploadedByProfileId: (req.session as any).profileId ?? null
    }).returning();

    const row = rows[0];
    if (!row) {
      return res.status(500).json({ error: { code: "INSERT_FAILED", message: "Failed to create file record" } });
    }

    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: "FILE_PRESIGN",
      entityType: "FILE",
      entityId: row.id,
      summary: `Presigned upload for ${dto.filename}`,
      meta: { storageKey, mime: dto.mime, sizeBytes: dto.sizeBytes },
      actorUserId: actor.userId,
      actorRoles: actor.roles,
      ip: actor.ip,
    });

    res.status(201).json({ fileId: row.id, storageKey, presigned });
  } catch (e) {
    next(e);
  }
});

filesRouter.post("/files/commit", async (req, res, next) => {
  try {
    const dto = CommitUploadDto.parse(req.body);
    const [row] = await db.select().from(fileObject).where(eq(fileObject.id, dto.fileId));
    if (!row) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "File not found" } });
    }

    const exists = await verifyExists(row.storageKey);
    if (!exists) {
      return res.status(400).json({ error: { code: "NOT_UPLOADED", message: "Object not found in storage" } });
    }

    const updRows = await db.update(fileObject).set({
      status: "READY",
      readyAt: new Date(),
      sizeBytes: dto.sizeBytes,
      sha256: dto.sha256 ?? row.sha256
    }).where(eq(fileObject.id, dto.fileId)).returning();

    const upd = updRows[0];
    if (!upd) {
      return res.status(500).json({ error: { code: "UPDATE_FAILED", message: "Failed to update file record" } });
    }

    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: "FILE_READY",
      entityType: "FILE",
      entityId: upd.id,
      summary: `File committed ${upd.filename}`,
      meta: { sizeBytes: upd.sizeBytes },
      actorUserId: actor.userId,
      actorRoles: actor.roles,
      ip: actor.ip,
    });

    res.json(upd);
  } catch (e) {
    next(e);
  }
});

filesRouter.get("/files/:id/download", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const [row] = await db.select().from(fileObject).where(eq(fileObject.id, id));
    if (!row || row.status !== "READY") {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "File not found" } });
    }

    const u = (req.session as any).user;
    const profileId = (req.session as any).profileId;
    const roles: string[] = u?.roles ?? [];
    const isPrivileged = roles.includes("ADMIN") || roles.includes("STAFF");
    const isUploader = profileId === row.uploadedByProfileId;

    if (!isPrivileged && !isUploader) {
      // Prefer downloading via /notes/:id after audience checks.
      return res.status(403).json({ error: { code: "NOT_ALLOWED", message: "Access denied" } });
    }

    const link = await presignGet(row.storageKey, row.filename);
    res.json({ url: link.url, filename: row.filename });
  } catch (e) {
    next(e);
  }
});