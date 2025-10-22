-- File: migrations/20220312230720_add_invited_by_user_id/migration.sql

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN "invitedByUserId" TEXT;
