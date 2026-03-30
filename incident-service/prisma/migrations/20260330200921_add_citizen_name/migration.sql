/*
  Warnings:

  - Added the required column `citizen_name` to the `incidents` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "citizen_name" TEXT NOT NULL DEFAULT 'Anonymous Caller';
-- Update the default column to empty string after applying
ALTER TABLE "incidents" ALTER COLUMN "citizen_name" DROP DEFAULT;
