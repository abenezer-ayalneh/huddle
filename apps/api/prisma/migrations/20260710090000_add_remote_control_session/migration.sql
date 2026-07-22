-- CreateTable
CREATE TABLE "remote_control_session" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "sharerIdentity" TEXT NOT NULL,
    "sharerName" TEXT NOT NULL,
    "controllerIdentity" TEXT NOT NULL,
    "controllerName" TEXT NOT NULL,
    "agentIdentity" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "renewalDueAt" TIMESTAMP(3),
    "endReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remote_control_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "remote_control_session_roomId_status_idx" ON "remote_control_session"("roomId", "status");

-- Only one audit row may describe an active grant for a room. Redis SET NX is
-- the runtime authority; this partial index is the persistence backstop.
CREATE UNIQUE INDEX "remote_control_session_one_active_per_room" ON "remote_control_session"("roomId") WHERE "status" = 'active';

-- AddForeignKey
ALTER TABLE "remote_control_session" ADD CONSTRAINT "remote_control_session_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
