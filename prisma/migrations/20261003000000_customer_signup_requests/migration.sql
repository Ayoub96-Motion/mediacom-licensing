-- Public request-access signups: Customer.status + Customer.teamSize.
-- NOT NULL DEFAULT 'active' backfills every existing customer to "active"
-- in the same statement, so current customers are unaffected.
ALTER TABLE `Customer`
    ADD COLUMN `status` ENUM('active', 'pending') NOT NULL DEFAULT 'active',
    ADD COLUMN `teamSize` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Customer_status_idx` ON `Customer`(`status`);
