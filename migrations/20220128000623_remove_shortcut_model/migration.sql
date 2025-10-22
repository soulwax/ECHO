-- File: migrations/20220128000623_remove_shortcut_model/migration.sql

/*
  Warnings:

  - You are about to drop the `Shortcut` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Shortcut";
PRAGMA foreign_keys=on;
