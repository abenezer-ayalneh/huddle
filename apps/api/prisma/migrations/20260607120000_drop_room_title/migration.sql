-- Rooms no longer have a human title; they are identified solely by their
-- auto-generated Room Code (the `slug`). Drop the now-unused column.
ALTER TABLE "room" DROP COLUMN "title";
