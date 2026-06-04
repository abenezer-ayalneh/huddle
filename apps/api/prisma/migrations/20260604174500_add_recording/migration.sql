-- CreateTable
CREATE TABLE "recording" (
    "id" TEXT NOT NULL,
    "egressId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'starting',
    "objectKey" TEXT NOT NULL,
    "sizeBytes" BIGINT,
    "durationMs" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "recording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recording_egressId_key" ON "recording"("egressId");

-- CreateIndex
CREATE INDEX "recording_roomId_idx" ON "recording"("roomId");

-- AddForeignKey
ALTER TABLE "recording" ADD CONSTRAINT "recording_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
