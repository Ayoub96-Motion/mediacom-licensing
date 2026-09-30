-- DropForeignKey
ALTER TABLE `AuditLog` DROP FOREIGN KEY `AuditLog_adminId_fkey`;

-- DropIndex
DROP INDEX `License_keyHash_idx` ON `License`;

-- AlterTable
ALTER TABLE `AuditLog` ADD COLUMN `actorType` ENUM('admin', 'customer', 'device') NOT NULL DEFAULT 'admin',
    MODIFY `adminId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Device` ADD COLUMN `appVersion` VARCHAR(191) NULL,
    ADD COLUMN `deactivatedAt` DATETIME(3) NULL,
    ADD COLUMN `fingerprintHash` CHAR(64) NULL,
    ADD COLUMN `machineName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `License` ADD COLUMN `keyEncrypted` TEXT NULL,
    ADD COLUMN `planCode` VARCHAR(191) NULL,
    MODIFY `keyHash` CHAR(64) NOT NULL;

-- CreateIndex
CREATE INDEX `Device_licenseId_deactivatedAt_idx` ON `Device`(`licenseId`, `deactivatedAt`);

-- CreateIndex
CREATE UNIQUE INDEX `Device_licenseId_fingerprintHash_key` ON `Device`(`licenseId`, `fingerprintHash`);

-- CreateIndex
CREATE UNIQUE INDEX `License_keyHash_key` ON `License`(`keyHash`);

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

