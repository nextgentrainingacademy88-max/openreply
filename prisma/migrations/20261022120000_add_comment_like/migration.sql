-- AlterTable
ALTER TABLE "Automation" ADD COLUMN     "likeComment" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DmLog" ADD COLUMN     "commentLikedAt" TIMESTAMP(3),
ADD COLUMN     "commentLikeError" TEXT;
