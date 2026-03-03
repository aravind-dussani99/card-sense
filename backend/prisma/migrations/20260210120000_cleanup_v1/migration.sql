-- Archive out-of-scope tables for V1
CREATE SCHEMA IF NOT EXISTS archive;

ALTER TABLE IF EXISTS "ChatSession" SET SCHEMA archive;
ALTER TABLE IF EXISTS "ChatMessage" SET SCHEMA archive;
ALTER TABLE IF EXISTS "ProcessedEmail" SET SCHEMA archive;
ALTER TABLE IF EXISTS "Offer" SET SCHEMA archive;

-- Drop deprecated tables
DROP TABLE IF EXISTS "DraftTransaction" CASCADE;
DROP TABLE IF EXISTS "Transaction" CASCADE;
DROP TABLE IF EXISTS "FromEntity" CASCADE;
DROP TABLE IF EXISTS "ToEntity" CASCADE;
