-- CreateTable
CREATE TABLE "CampaignFollow" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "instagramUserId" TEXT NOT NULL,
    "notFollowingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followedAt" TIMESTAMP(3),

    CONSTRAINT "CampaignFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignFollow_workspaceId_idx" ON "CampaignFollow"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignFollow_automationId_instagramUserId_key" ON "CampaignFollow"("automationId", "instagramUserId");

-- AddForeignKey
ALTER TABLE "CampaignFollow" ADD CONSTRAINT "CampaignFollow_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
