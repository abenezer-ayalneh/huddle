CREATE TABLE "account_deletion" (
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_deletion_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "account_deletion_status_updatedAt_idx" ON "account_deletion"("status", "updatedAt");

ALTER TABLE "account_deletion" ADD CONSTRAINT "account_deletion_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
