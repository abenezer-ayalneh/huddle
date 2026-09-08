CREATE TABLE "maintenance_cleanup" (
  "roomSid" TEXT NOT NULL,
  "roomName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "maintenance_cleanup_pkey" PRIMARY KEY ("roomSid")
);
