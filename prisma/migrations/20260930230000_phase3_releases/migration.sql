-- CreateTable
CREATE TABLE `Release` (
    `id` VARCHAR(191) NOT NULL,
    `product` ENUM('server-win', 'android', 'ios') NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `channel` ENUM('stable', 'beta') NOT NULL DEFAULT 'stable',
    `storageKey` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `sha256` CHAR(64) NULL,
    `externalUrl` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `minPlanCode` VARCHAR(191) NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `publishedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Release_product_channel_isPublished_idx`(`product`, `channel`, `isPublished`),
    UNIQUE INDEX `Release_product_version_key`(`product`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Release` ADD CONSTRAINT `Release_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `AdminUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

