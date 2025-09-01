#!/usr/bin/env bun
/**
 * File cleanup and maintenance script for Module 7 - Content & File Sharing
 * 
 * This script handles:
 * 1. Orphan cleanup (weekly) - Files in READY not referenced by any note_attachment older than N days
 * 2. PENDING timeout (daily) - Files stuck in PENDING for >48h
 * 3. Physical file cleanup from disk
 */

import { db } from '../src/db/client';
import { fileObject, noteAttachment } from '../src/db/schema/content';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import fs from 'node:fs/promises';
import path from 'node:path';

const cfg = {
  localDir: process.env.LOCAL_UPLOAD_DIR ?? './uploads',
  orphanDays: 30, // Delete orphaned files after 30 days
  pendingHours: 48, // Delete pending files after 48 hours
};

async function cleanupOrphanedFiles() {
  console.log('🧹 Starting orphaned files cleanup...');
  
  // Find files in READY status not referenced by any note_attachment older than N days
  const orphanedFiles = await db
    .select({
      id: fileObject.id,
      storageKey: fileObject.storageKey,
      filename: fileObject.filename,
      createdAt: fileObject.createdAt
    })
    .from(fileObject)
    .leftJoin(noteAttachment, eq(fileObject.id, noteAttachment.fileId))
    .where(
      and(
        eq(fileObject.status, 'READY'),
        isNull(noteAttachment.fileId),
        lt(fileObject.createdAt, sql`now() - interval '${cfg.orphanDays} days'`)
      )
    );

  console.log(`Found ${orphanedFiles.length} orphaned files to cleanup`);

  for (const file of orphanedFiles) {
    try {
      // Delete physical file from disk
      const filePath = path.join(cfg.localDir, file.storageKey);
      try {
        await fs.unlink(filePath);
        console.log(`🗑️  Deleted file: ${file.filename} (${file.storageKey})`);
      } catch (fsError) {
        console.warn(`⚠️  File not found on disk: ${file.storageKey}`);
      }

      // Mark as DELETED in database
      await db.update(fileObject)
        .set({ status: 'DELETED', deletedAt: new Date() })
        .where(eq(fileObject.id, file.id));

      console.log(`✅ Marked as deleted: ${file.filename}`);
    } catch (error) {
      console.error(`❌ Failed to cleanup file ${file.filename}:`, error);
    }
  }

  console.log(`✨ Orphaned files cleanup completed: ${orphanedFiles.length} files processed`);
}

async function cleanupPendingFiles() {
  console.log('⏰ Starting pending files cleanup...');
  
  // Find files stuck in PENDING for more than 48 hours
  const pendingFiles = await db
    .select({
      id: fileObject.id,
      storageKey: fileObject.storageKey,
      filename: fileObject.filename,
      createdAt: fileObject.createdAt
    })
    .from(fileObject)
    .where(
      and(
        eq(fileObject.status, 'PENDING'),
        lt(fileObject.createdAt, sql`now() - interval '${cfg.pendingHours} hours'`)
      )
    );

  console.log(`Found ${pendingFiles.length} stale pending files to cleanup`);

  for (const file of pendingFiles) {
    try {
      // Delete physical file from disk if it exists
      const filePath = path.join(cfg.localDir, file.storageKey);
      try {
        await fs.unlink(filePath);
        console.log(`🗑️  Deleted pending file: ${file.filename} (${file.storageKey})`);
      } catch (fsError) {
        console.warn(`⚠️  Pending file not found on disk: ${file.storageKey}`);
      }

      // Mark as DELETED in database
      await db.update(fileObject)
        .set({ status: 'DELETED', deletedAt: new Date() })
        .where(eq(fileObject.id, file.id));

      console.log(`✅ Marked pending file as deleted: ${file.filename}`);
    } catch (error) {
      console.error(`❌ Failed to cleanup pending file ${file.filename}:`, error);
    }
  }

  console.log(`✨ Pending files cleanup completed: ${pendingFiles.length} files processed`);
}

async function cleanupDeletedRecords() {
  console.log('🗄️  Starting deleted records cleanup...');
  
  // Remove file records marked as DELETED for more than 7 days
  const result = await db
    .delete(fileObject)
    .where(
      and(
        eq(fileObject.status, 'DELETED'),
        lt(fileObject.deletedAt, sql`now() - interval '7 days'`)
      )
    );

  console.log(`✨ Deleted records cleanup completed: ${result.length || 0} records removed`);
}

async function generateStorageReport() {
  console.log('📊 Generating storage report...');
  
  const stats = await db
    .select({
      status: fileObject.status,
      count: sql<number>`count(*)`,
      totalSize: sql<number>`sum(size_bytes)`,
    })
    .from(fileObject)
    .groupBy(fileObject.status);

  console.log('\n📈 Storage Statistics:');
  console.log('========================');
  
  let totalFiles = 0;
  let totalSize = 0;
  
  for (const stat of stats) {
    const sizeInMB = Math.round((stat.totalSize || 0) / (1024 * 1024));
    console.log(`${stat.status}: ${stat.count} files, ${sizeInMB} MB`);
    totalFiles += stat.count;
    totalSize += stat.totalSize || 0;
  }
  
  const totalSizeInMB = Math.round(totalSize / (1024 * 1024));
  console.log('========================');
  console.log(`TOTAL: ${totalFiles} files, ${totalSizeInMB} MB`);
  console.log('');
}

async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'orphans':
        await cleanupOrphanedFiles();
        break;
      case 'pending':
        await cleanupPendingFiles();
        break;
      case 'deleted':
        await cleanupDeletedRecords();
        break;
      case 'report':
        await generateStorageReport();
        break;
      case 'all':
      default:
        await cleanupPendingFiles();
        await cleanupOrphanedFiles();
        await cleanupDeletedRecords();
        await generateStorageReport();
        break;
    }
    
    console.log('🎉 Cleanup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Cleanup failed:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}