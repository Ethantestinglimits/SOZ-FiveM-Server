-- CreateTable
CREATE TABLE `dynamic_prop_graffiti` (
    `id` VARCHAR(128) NOT NULL,
    `gangId` INTEGER NOT NULL,
    `imageUrl` TEXT NULL,
    `position` TEXT NOT NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
