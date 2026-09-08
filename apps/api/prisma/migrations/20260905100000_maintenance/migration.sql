CREATE TABLE "maintenance_state" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "message" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "maintenance_state_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "maintenance_singleton" CHECK ("id" = 1)
);
