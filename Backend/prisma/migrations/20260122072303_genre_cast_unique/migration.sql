/*
  Warnings:

  - You are about to drop the column `movieId` on the `Cast` table. All the data in the column will be lost.
  - The primary key for the `Genre` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_GenreToMovie` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[name]` on the table `Cast` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Genre` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Cast" DROP CONSTRAINT "Cast_movieId_fkey";

-- DropForeignKey
ALTER TABLE "_GenreToMovie" DROP CONSTRAINT "_GenreToMovie_A_fkey";

-- AlterTable
ALTER TABLE "Cast" DROP COLUMN "movieId",
ALTER COLUMN "profilePath" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Genre" DROP CONSTRAINT "Genre_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Genre_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "_GenreToMovie" DROP CONSTRAINT "_GenreToMovie_AB_pkey",
ALTER COLUMN "A" SET DATA TYPE TEXT,
ADD CONSTRAINT "_GenreToMovie_AB_pkey" PRIMARY KEY ("A", "B");

-- CreateTable
CREATE TABLE "_CastToMovie" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CastToMovie_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CastToMovie_B_index" ON "_CastToMovie"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Cast_name_key" ON "Cast"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_name_key" ON "Genre"("name");

-- AddForeignKey
ALTER TABLE "_GenreToMovie" ADD CONSTRAINT "_GenreToMovie_A_fkey" FOREIGN KEY ("A") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CastToMovie" ADD CONSTRAINT "_CastToMovie_A_fkey" FOREIGN KEY ("A") REFERENCES "Cast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CastToMovie" ADD CONSTRAINT "_CastToMovie_B_fkey" FOREIGN KEY ("B") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
