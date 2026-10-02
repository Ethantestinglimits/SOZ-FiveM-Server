-- CreateTable
CREATE TABLE `prop_animation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `model` INTEGER NOT NULL,
    `label` VARCHAR(32) NOT NULL,
    `animation` TEXT NOT NULL,
    `offset` VARCHAR(255) NOT NULL,
    `citizen_id` VARCHAR(50) NOT NULL,
    `creator_name` VARCHAR(64) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `prop_animation_model_idx`(`model`),
    INDEX `prop_animation_citizen_id_idx`(`citizen_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
