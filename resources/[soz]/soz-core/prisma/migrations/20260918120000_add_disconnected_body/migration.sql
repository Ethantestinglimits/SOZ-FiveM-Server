-- CreateTable
CREATE TABLE `disconnected_body` (
    `citizenid` VARCHAR(50) NOT NULL,
    `position` LONGTEXT NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `skin` LONGTEXT NOT NULL,
    `outfit` LONGTEXT NOT NULL,
    `animation` LONGTEXT NULL,
    `is_dead` BOOLEAN NOT NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`citizenid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
