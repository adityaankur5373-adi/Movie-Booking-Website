/*
  Warnings:

  - A unique constraint covering the columns `[screenId,startTime]` on the table `Show` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Show_screenId_startTime_key" ON "Show"("screenId", "startTime");
