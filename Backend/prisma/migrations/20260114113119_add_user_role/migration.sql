/*
  Warnings:

  - You are about to drop the column `googleId` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "googleId",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';
