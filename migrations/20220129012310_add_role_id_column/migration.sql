-- File: migrations/20220129012310_add_role_id_column/migration.sql

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN "roleId" TEXT;
