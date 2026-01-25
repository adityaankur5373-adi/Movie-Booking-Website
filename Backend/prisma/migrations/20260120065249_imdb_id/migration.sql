/*
  Warnings:

  - You are about to drop the column `tmdbId` on the `Movie` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[imdbId]` on the table `Movie` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Movie_tmdbId_key";

-- AlterTable
ALTER TABLE "Movie" DROP COLUMN "tmdbId",
ADD COLUMN     "imdbId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Movie_imdbId_key" ON "Movie"("imdbId");
