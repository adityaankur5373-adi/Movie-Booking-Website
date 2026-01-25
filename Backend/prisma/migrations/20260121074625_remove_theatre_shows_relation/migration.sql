/*
  Warnings:

  - You are about to drop the column `theatreId` on the `Show` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Theatre` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `Theatre` table. All the data in the column will be lost.
  - You are about to drop the column `screens` on the `Theatre` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Show" DROP CONSTRAINT "Show_theatreId_fkey";

-- AlterTable
ALTER TABLE "Show" DROP COLUMN "theatreId";

-- AlterTable
ALTER TABLE "Theatre" DROP COLUMN "createdAt",
DROP COLUMN "image",
DROP COLUMN "screens";
