-- AlterEnum
BEGIN;
CREATE TYPE "ResourceZone_new" AS ENUM ('RESORT', 'POOL_VILLA', 'BANQUET');
ALTER TABLE "Resource" ALTER COLUMN "zone" TYPE "ResourceZone_new" USING ("zone"::text::"ResourceZone_new");
ALTER TYPE "ResourceZone" RENAME TO "ResourceZone_old";
ALTER TYPE "ResourceZone_new" RENAME TO "ResourceZone";
DROP TYPE "public"."ResourceZone_old";
COMMIT;
