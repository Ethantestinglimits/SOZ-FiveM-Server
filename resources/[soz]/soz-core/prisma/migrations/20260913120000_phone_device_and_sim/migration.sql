-- =============================================================================
-- Phone rework - Etape 1 : l'appareil (phone_device) et la Carte ZIM (phone_sim)
--
-- Cette migration est ADDITIVE : aucune colonne existante n'est supprimee ni
-- renommee. L'ancien systeme (donnees indexees par citizenid / charinfo.phone)
-- continue de fonctionner tant que le code n'a pas bascule.
--
-- /!\ A jouer serveur ETEINT : la table `inventories` est mise a jour ici, et
--     les inventaires charges en memoire ecraseraient la modification.
-- =============================================================================

-- CreateTable
CREATE TABLE `phone_sim` (
    `number` VARCHAR(10) NOT NULL,
    `owner` VARCHAR(50) NULL,
    `avatar` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `owner`(`owner`),
    PRIMARY KEY (`number`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `phone_device` (
    `id` VARCHAR(36) NOT NULL,
    `frame` VARCHAR(64) NOT NULL DEFAULT 'black.webp',
    `owner` VARCHAR(50) NULL,
    `main_for` VARCHAR(50) NULL,
    `sim_number` VARCHAR(10) NULL,
    `pin_code` VARCHAR(8) NULL,
    `initialized` BOOLEAN NOT NULL DEFAULT false,
    `settings` JSON NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `main_for`(`main_for`),
    UNIQUE INDEX `sim_number`(`sim_number`),
    INDEX `owner`(`owner`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `phone_device` ADD CONSTRAINT `FK_phone_device_sim` FOREIGN KEY (`sim_number`) REFERENCES `phone_sim`(`number`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `phone_calls` ADD COLUMN `device_id` VARCHAR(36) NULL;
ALTER TABLE `phone_contacts` ADD COLUMN `device_id` VARCHAR(36) NULL;
ALTER TABLE `phone_gallery` ADD COLUMN `device_id` VARCHAR(36) NULL;
ALTER TABLE `phone_messages` ADD COLUMN `device_id` VARCHAR(36) NULL;
ALTER TABLE `phone_messages_conversations` ADD COLUMN `device_id` VARCHAR(36) NULL;
ALTER TABLE `phone_notes` ADD COLUMN `device_id` VARCHAR(36) NULL;

-- CreateIndex
CREATE INDEX `device_id` ON `phone_calls`(`device_id`);
CREATE INDEX `device_id` ON `phone_contacts`(`device_id`);
CREATE INDEX `device_id` ON `phone_gallery`(`device_id`);
CREATE INDEX `device_id` ON `phone_messages`(`device_id`);
CREATE INDEX `device_id` ON `phone_messages_conversations`(`device_id`);
CREATE INDEX `device_id` ON `phone_notes`(`device_id`);

-- =============================================================================
-- Reprise des donnees existantes
-- =============================================================================

-- Une Carte ZIM par personnage, portant son numero actuel (charinfo.phone).
INSERT IGNORE INTO `phone_sim` (`number`, `owner`, `created_at`)
SELECT JSON_UNQUOTE(JSON_EXTRACT(`charinfo`, '$.phone')), `citizenid`, `created_at`
FROM `player`
WHERE `charinfo` IS NOT NULL
  AND JSON_VALID(`charinfo`)
  AND JSON_UNQUOTE(JSON_EXTRACT(`charinfo`, '$.phone')) IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(`charinfo`, '$.phone')) <> '';

-- L'avatar est une propriete du numero : on le rapatrie depuis phone_profile.
UPDATE `phone_sim` `s`
    JOIN `phone_profile` `p` ON `p`.`number` = `s`.`number`
SET `s`.`avatar` = `p`.`avatar`;

-- Un appareil par personnage : deja initialise (pas d'onboarding impose aux
-- joueurs existants), sans code PIN, ZIM inseree, et defini comme principal.
INSERT INTO `phone_device` (`id`, `owner`, `main_for`, `sim_number`, `initialized`, `created_at`, `updated_at`)
SELECT UUID(), `s`.`owner`, `s`.`owner`, `s`.`number`, true, `s`.`created_at`, NOW()
FROM `phone_sim` `s`
WHERE `s`.`owner` IS NOT NULL;

-- Donnees indexees par citizenid -> appareil principal du personnage.
UPDATE `phone_contacts` `c`
    JOIN `phone_device` `d` ON `d`.`main_for` = `c`.`identifier`
SET `c`.`device_id` = `d`.`id`;

UPDATE `phone_notes` `n`
    JOIN `phone_device` `d` ON `d`.`main_for` = `n`.`identifier`
SET `n`.`device_id` = `d`.`id`;

UPDATE `phone_gallery` `g`
    JOIN `phone_device` `d` ON `d`.`main_for` = `g`.`identifier`
SET `g`.`device_id` = `d`.`id`;

UPDATE `phone_calls` `ca`
    JOIN `phone_device` `d` ON `d`.`main_for` = `ca`.`identifier`
SET `ca`.`device_id` = `d`.`id`;

-- Donnees indexees par numero -> appareil qui porte cette ZIM.
UPDATE `phone_messages_conversations` `c`
    JOIN `phone_device` `d` ON `d`.`sim_number` = `c`.`user_identifier`
SET `c`.`device_id` = `d`.`id`;

-- Les SMS appartiennent desormais a l'appareil : chaque appareil a sa copie.
-- On rattache d'abord la copie de l'emetteur (user_identifier = citizenid).
UPDATE `phone_messages` `m`
    JOIN `phone_device` `d` ON `d`.`main_for` = `m`.`user_identifier`
SET `m`.`device_id` = `d`.`id`;

-- Puis on duplique pour les autres participants de la conversation. Limite aux
-- 30 derniers jours : l'application n'affiche que 14 jours d'historique.
SET @phone_rework_max_message_id = (SELECT COALESCE(MAX(`id`), 0) FROM `phone_messages`);

INSERT INTO `phone_messages` (`device_id`, `message`, `user_identifier`, `conversation_id`, `isRead`, `visible`, `author`, `createdAt`, `updatedAt`)
SELECT `c`.`device_id`,
       `m`.`message`,
       `m`.`user_identifier`,
       `m`.`conversation_id`,
       `m`.`isRead`,
       `m`.`visible`,
       `m`.`author`,
       `m`.`createdAt`,
       `m`.`updatedAt`
FROM `phone_messages` `m`
    JOIN (
        SELECT DISTINCT `conversation_id`, `device_id`
        FROM `phone_messages_conversations`
        WHERE `device_id` IS NOT NULL
    ) `c` ON `c`.`conversation_id` = `m`.`conversation_id`
WHERE `m`.`id` <= @phone_rework_max_message_id
  AND `m`.`createdAt` >= DATE_SUB(NOW(), INTERVAL 30 DAY)
  AND (`m`.`device_id` IS NULL OR `m`.`device_id` <> `c`.`device_id`);

-- L'item `phone` deja present dans l'inventaire du joueur recoit l'id de son
-- appareil dans sa metadata. Les items non traites ici (2e telephone, telephone
-- range dans un coffre / une planque) sont rattaches a la volee cote serveur.
UPDATE `inventories` `i`
    JOIN `phone_device` `d` ON `i`.`id` = CONCAT('player_', `d`.`main_for`)
SET `i`.`items` = JSON_SET(
        `i`.`items`,
        REPLACE(JSON_UNQUOTE(JSON_SEARCH(`i`.`items`, 'one', 'phone', NULL, '$.*.name')), '.name', '.metadata'),
        JSON_MERGE_PATCH(
            COALESCE(
                JSON_EXTRACT(`i`.`items`, REPLACE(JSON_UNQUOTE(JSON_SEARCH(`i`.`items`, 'one', 'phone', NULL, '$.*.name')), '.name', '.metadata')),
                JSON_OBJECT()
            ),
            JSON_OBJECT('id', `d`.`id`)
        )
    )
WHERE `i`.`type` = 'player'
  AND JSON_SEARCH(`i`.`items`, 'one', 'phone', NULL, '$.*.name') IS NOT NULL
  AND JSON_EXTRACT(`i`.`items`, REPLACE(JSON_UNQUOTE(JSON_SEARCH(`i`.`items`, 'one', 'phone', NULL, '$.*.name')), '.name', '.metadata.id')) IS NULL;
