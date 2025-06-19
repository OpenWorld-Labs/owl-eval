-- AlterTable
ALTER TABLE "Experiment" ADD COLUMN     "evaluationMode" TEXT NOT NULL DEFAULT 'comparison';

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "assignedVideoTasks" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "VideoTask" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "videoPath" TEXT NOT NULL,
    "videoId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SingleVideoEvaluation" (
    "id" TEXT NOT NULL,
    "videoTaskId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "dimensionScores" JSONB NOT NULL,
    "completionTimeSeconds" DOUBLE PRECISION,
    "clientMetadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lastSavedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SingleVideoEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoTask_experimentId_idx" ON "VideoTask"("experimentId");

-- CreateIndex
CREATE INDEX "VideoTask_scenarioId_idx" ON "VideoTask"("scenarioId");

-- CreateIndex
CREATE INDEX "SingleVideoEvaluation_videoTaskId_idx" ON "SingleVideoEvaluation"("videoTaskId");

-- CreateIndex
CREATE INDEX "SingleVideoEvaluation_participantId_idx" ON "SingleVideoEvaluation"("participantId");

-- CreateIndex
CREATE INDEX "SingleVideoEvaluation_experimentId_idx" ON "SingleVideoEvaluation"("experimentId");

-- CreateIndex
CREATE INDEX "SingleVideoEvaluation_status_idx" ON "SingleVideoEvaluation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SingleVideoEvaluation_videoTaskId_participantId_key" ON "SingleVideoEvaluation"("videoTaskId", "participantId");

-- CreateIndex
CREATE INDEX "Experiment_evaluationMode_idx" ON "Experiment"("evaluationMode");

-- AddForeignKey
ALTER TABLE "VideoTask" ADD CONSTRAINT "VideoTask_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoTask" ADD CONSTRAINT "VideoTask_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SingleVideoEvaluation" ADD CONSTRAINT "SingleVideoEvaluation_videoTaskId_fkey" FOREIGN KEY ("videoTaskId") REFERENCES "VideoTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SingleVideoEvaluation" ADD CONSTRAINT "SingleVideoEvaluation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SingleVideoEvaluation" ADD CONSTRAINT "SingleVideoEvaluation_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
