-- Phase 8 enhancement: temporary local recording copies, optional Drive
-- delivery, and explicit recipient permissions. Existing recordings are
-- initialized by the worker with a deployment-time grace period so this
-- migration never deletes historical media by itself.

ALTER TABLE "recording"
  ADD COLUMN "localExpiresAt" TIMESTAMP(3),
  ADD COLUMN "localDeleteAfter" TIMESTAMP(3),
  ADD COLUMN "localDeletedAt" TIMESTAMP(3),
  ADD COLUMN "driveShareAvailable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deliveryWarningSentAt" TIMESTAMP(3),
  ADD COLUMN "finalWarningSentAt" TIMESTAMP(3);

CREATE TABLE "cloud_storage_connection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'google_drive',
  "providerEmail" TEXT,
  "encryptedRefreshToken" TEXT,
  "driveFolderId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'connected',
  "disconnectedAt" TIMESTAMP(3),
  "backfillRequestedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cloud_storage_connection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recording_delivery" (
  "id" TEXT NOT NULL,
  "recordingId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'google_drive',
  "status" TEXT NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseOwner" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "encryptedUploadSession" TEXT,
  "uploadOffsetBytes" BIGINT NOT NULL DEFAULT 0,
  "driveFileId" TEXT,
  "driveUrl" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "lastError" TEXT,
  "actionNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recording_delivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recording_recipient" (
  "id" TEXT NOT NULL,
  "recordingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "permissionId" TEXT,
  "error" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recording_recipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cloud_storage_connection_userId_provider_key" ON "cloud_storage_connection"("userId", "provider");
CREATE UNIQUE INDEX "recording_delivery_recordingId_key" ON "recording_delivery"("recordingId");
CREATE UNIQUE INDEX "recording_recipient_recordingId_userId_key" ON "recording_recipient"("recordingId", "userId");
CREATE INDEX "recording_localDeleteAfter_idx" ON "recording"("localDeleteAfter");
CREATE INDEX "recording_localExpiresAt_idx" ON "recording"("localExpiresAt");
CREATE INDEX "recording_delivery_status_nextAttemptAt_idx" ON "recording_delivery"("status", "nextAttemptAt");
CREATE INDEX "recording_delivery_leaseUntil_idx" ON "recording_delivery"("leaseUntil");
CREATE INDEX "recording_recipient_recordingId_status_idx" ON "recording_recipient"("recordingId", "status");

ALTER TABLE "cloud_storage_connection" ADD CONSTRAINT "cloud_storage_connection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recording_delivery" ADD CONSTRAINT "recording_delivery_recordingId_fkey"
  FOREIGN KEY ("recordingId") REFERENCES "recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recording_recipient" ADD CONSTRAINT "recording_recipient_recordingId_fkey"
  FOREIGN KEY ("recordingId") REFERENCES "recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recording_recipient" ADD CONSTRAINT "recording_recipient_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
