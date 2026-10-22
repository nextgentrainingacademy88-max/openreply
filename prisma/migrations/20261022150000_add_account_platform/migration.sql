-- CreateEnum
CREATE TYPE "AccountPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK');

-- AlterTable
ALTER TABLE "InstagramAccount" ADD COLUMN     "platform" "AccountPlatform" NOT NULL DEFAULT 'INSTAGRAM';
