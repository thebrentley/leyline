import { MigrationInterface, QueryRunner } from "typeorm";

export class CamelToSnakeCase1769532303427 implements MigrationInterface {
    name = 'CamelToSnakeCase1769532303427'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Step 1: Drop all foreign key constraints
        await queryRunner.query(`ALTER TABLE "collection_cards" DROP CONSTRAINT "FK_2619a36ae9344cab949455593e2"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" DROP CONSTRAINT "FK_73202b7bced590cc08fc2a5675f"`);
        await queryRunner.query(`ALTER TABLE "deck_cards" DROP CONSTRAINT "FK_d738483b88c1cbcfdf84376278c"`);
        await queryRunner.query(`ALTER TABLE "deck_cards" DROP CONSTRAINT "FK_b8c9825e6c1cb080df843a99003"`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" DROP CONSTRAINT "FK_d0320df1059d8a029a460f4161d"`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" DROP CONSTRAINT "FK_c55a90f52ef85578ece8e9290cb"`);
        await queryRunner.query(`ALTER TABLE "decks" DROP CONSTRAINT "FK_d60e048034edfd232e0b8cedaeb"`);
        await queryRunner.query(`ALTER TABLE "deck_versions" DROP CONSTRAINT "FK_eb0c2efa04f99dd1199c3b620cd"`);

        // Step 2: Drop all indexes
        await queryRunner.query(`DROP INDEX "public"."IDX_ff173be641ca715e59a584ff49"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f9f2c37cffe9843926531654a2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9d2e571ea70f8504d15b87f0f1"`);

        // Step 3: Drop unique constraint on users.archidektId
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_473c8271b937b822431ef774c04"`);

        // Step 4: Rename all columns (preserves data!)

        // users table
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "passwordHash" TO "password_hash"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "displayName" TO "display_name"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "archidektId" TO "archidekt_id"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "archidektUsername" TO "archidekt_username"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "archidektEmail" TO "archidekt_email"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "archidektToken" TO "archidekt_token"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "archidektPassword" TO "archidekt_password"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "archidektConnectedAt" TO "archidekt_connected_at"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "createdAt" TO "created_at"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "updatedAt" TO "updated_at"`);

        // decks table
        await queryRunner.query(`ALTER TABLE "decks" RENAME COLUMN "userId" TO "user_id"`);
        await queryRunner.query(`ALTER TABLE "decks" RENAME COLUMN "archidektId" TO "archidekt_id"`);
        await queryRunner.query(`ALTER TABLE "decks" RENAME COLUMN "lastSyncedAt" TO "last_synced_at"`);
        await queryRunner.query(`ALTER TABLE "decks" RENAME COLUMN "syncStatus" TO "sync_status"`);
        await queryRunner.query(`ALTER TABLE "decks" RENAME COLUMN "syncError" TO "sync_error"`);
        await queryRunner.query(`ALTER TABLE "decks" RENAME COLUMN "colorTags" TO "color_tags"`);
        await queryRunner.query(`ALTER TABLE "decks" RENAME COLUMN "createdAt" TO "created_at"`);
        await queryRunner.query(`ALTER TABLE "decks" RENAME COLUMN "updatedAt" TO "updated_at"`);

        // cards table
        await queryRunner.query(`ALTER TABLE "cards" DROP CONSTRAINT "PK_19e3732fdb7768becc2ebc5f19a"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "scryfallId" TO "scryfall_id"`);
        await queryRunner.query(`ALTER TABLE "cards" ADD CONSTRAINT "PK_1d19ecc933d8be4de1bffb2d6ce" PRIMARY KEY ("scryfall_id")`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "setCode" TO "set_code"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "collectorNumber" TO "collector_number"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "setName" TO "set_name"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "manaCost" TO "mana_cost"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "typeLine" TO "type_line"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "oracleText" TO "oracle_text"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "colorIdentity" TO "color_identity"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "imageNormal" TO "image_normal"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "imageSmall" TO "image_small"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "imageArtCrop" TO "image_art_crop"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "imagePng" TO "image_png"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "priceUsd" TO "price_usd"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "priceUsdFoil" TO "price_usd_foil"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "cardFaces" TO "card_faces"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "fetchedAt" TO "fetched_at"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "pricesUpdatedAt" TO "prices_updated_at"`);

        // deck_cards table
        await queryRunner.query(`ALTER TABLE "deck_cards" RENAME COLUMN "deckId" TO "deck_id"`);
        await queryRunner.query(`ALTER TABLE "deck_cards" RENAME COLUMN "scryfallId" TO "scryfall_id"`);
        await queryRunner.query(`ALTER TABLE "deck_cards" RENAME COLUMN "colorTag" TO "color_tag"`);
        await queryRunner.query(`ALTER TABLE "deck_cards" RENAME COLUMN "isCommander" TO "is_commander"`);

        // collection_cards table
        await queryRunner.query(`ALTER TABLE "collection_cards" RENAME COLUMN "userId" TO "user_id"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" RENAME COLUMN "scryfallId" TO "scryfall_id"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" RENAME COLUMN "foilQuantity" TO "foil_quantity"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" RENAME COLUMN "originalPriceUsd" TO "original_price_usd"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" RENAME COLUMN "originalPriceUsdFoil" TO "original_price_usd_foil"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" RENAME COLUMN "linkedDeckCard" TO "linked_deck_card"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" RENAME COLUMN "addedAt" TO "added_at"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" RENAME COLUMN "updatedAt" TO "updated_at"`);

        // chat_sessions table
        await queryRunner.query(`ALTER TABLE "chat_sessions" RENAME COLUMN "userId" TO "user_id"`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" RENAME COLUMN "deckId" TO "deck_id"`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" RENAME COLUMN "pendingChanges" TO "pending_changes"`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" RENAME COLUMN "createdAt" TO "created_at"`);

        // deck_versions table
        await queryRunner.query(`ALTER TABLE "deck_versions" RENAME COLUMN "deckId" TO "deck_id"`);
        await queryRunner.query(`ALTER TABLE "deck_versions" RENAME COLUMN "versionNumber" TO "version_number"`);
        await queryRunner.query(`ALTER TABLE "deck_versions" RENAME COLUMN "changeType" TO "change_type"`);
        await queryRunner.query(`ALTER TABLE "deck_versions" RENAME COLUMN "colorTags" TO "color_tags"`);
        await queryRunner.query(`ALTER TABLE "deck_versions" RENAME COLUMN "cardCount" TO "card_count"`);
        await queryRunner.query(`ALTER TABLE "deck_versions" RENAME COLUMN "createdAt" TO "created_at"`);

        // Step 5: Recreate unique constraint on users.archidekt_id
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_e1bf2f93a630959ad3d42260630" UNIQUE ("archidekt_id")`);

        // Step 6: Recreate indexes with new column names
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_6aec27377d1ba00db0bc1778d7" ON "collection_cards" ("user_id", "scryfall_id")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0e24458412362d201e51f25981" ON "cards" ("set_code", "collector_number")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_acf935cb63c4bdd9557f16eeda" ON "deck_cards" ("deck_id", "scryfall_id")`);

        // Step 7: Recreate foreign key constraints with new column names
        await queryRunner.query(`ALTER TABLE "collection_cards" ADD CONSTRAINT "FK_5380ec86a0832d10dca72ce2fa3" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "collection_cards" ADD CONSTRAINT "FK_2bd4940e38468d71c0779fea6fd" FOREIGN KEY ("scryfall_id") REFERENCES "cards"("scryfall_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deck_cards" ADD CONSTRAINT "FK_edd1ac885107a30f7c7dc67c6b9" FOREIGN KEY ("deck_id") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deck_cards" ADD CONSTRAINT "FK_96b016c42d54dcda47d67efa234" FOREIGN KEY ("scryfall_id") REFERENCES "cards"("scryfall_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" ADD CONSTRAINT "FK_1fa209cf48ae975a109366542a5" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" ADD CONSTRAINT "FK_63995ce8a475b4496bc7a168fa8" FOREIGN KEY ("deck_id") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "decks" ADD CONSTRAINT "FK_329af7716096378c8e13125edd5" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deck_versions" ADD CONSTRAINT "FK_98a2eba5485a5708771b8bab1f6" FOREIGN KEY ("deck_id") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Step 1: Drop all foreign key constraints
        await queryRunner.query(`ALTER TABLE "deck_versions" DROP CONSTRAINT "FK_98a2eba5485a5708771b8bab1f6"`);
        await queryRunner.query(`ALTER TABLE "decks" DROP CONSTRAINT "FK_329af7716096378c8e13125edd5"`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" DROP CONSTRAINT "FK_63995ce8a475b4496bc7a168fa8"`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" DROP CONSTRAINT "FK_1fa209cf48ae975a109366542a5"`);
        await queryRunner.query(`ALTER TABLE "deck_cards" DROP CONSTRAINT "FK_96b016c42d54dcda47d67efa234"`);
        await queryRunner.query(`ALTER TABLE "deck_cards" DROP CONSTRAINT "FK_edd1ac885107a30f7c7dc67c6b9"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" DROP CONSTRAINT "FK_2bd4940e38468d71c0779fea6fd"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" DROP CONSTRAINT "FK_5380ec86a0832d10dca72ce2fa3"`);

        // Step 2: Drop indexes
        await queryRunner.query(`DROP INDEX "public"."IDX_acf935cb63c4bdd9557f16eeda"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0e24458412362d201e51f25981"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6aec27377d1ba00db0bc1778d7"`);

        // Step 3: Drop unique constraint on users.archidekt_id
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_e1bf2f93a630959ad3d42260630"`);

        // Step 4: Rename all columns back to camelCase

        // deck_versions table
        await queryRunner.query(`ALTER TABLE "deck_versions" RENAME COLUMN "created_at" TO "createdAt"`);
        await queryRunner.query(`ALTER TABLE "deck_versions" RENAME COLUMN "card_count" TO "cardCount"`);
        await queryRunner.query(`ALTER TABLE "deck_versions" RENAME COLUMN "color_tags" TO "colorTags"`);
        await queryRunner.query(`ALTER TABLE "deck_versions" RENAME COLUMN "change_type" TO "changeType"`);
        await queryRunner.query(`ALTER TABLE "deck_versions" RENAME COLUMN "version_number" TO "versionNumber"`);
        await queryRunner.query(`ALTER TABLE "deck_versions" RENAME COLUMN "deck_id" TO "deckId"`);

        // chat_sessions table
        await queryRunner.query(`ALTER TABLE "chat_sessions" RENAME COLUMN "created_at" TO "createdAt"`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" RENAME COLUMN "pending_changes" TO "pendingChanges"`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" RENAME COLUMN "deck_id" TO "deckId"`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" RENAME COLUMN "user_id" TO "userId"`);

        // collection_cards table
        await queryRunner.query(`ALTER TABLE "collection_cards" RENAME COLUMN "updated_at" TO "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" RENAME COLUMN "added_at" TO "addedAt"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" RENAME COLUMN "linked_deck_card" TO "linkedDeckCard"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" RENAME COLUMN "original_price_usd_foil" TO "originalPriceUsdFoil"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" RENAME COLUMN "original_price_usd" TO "originalPriceUsd"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" RENAME COLUMN "foil_quantity" TO "foilQuantity"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" RENAME COLUMN "scryfall_id" TO "scryfallId"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" RENAME COLUMN "user_id" TO "userId"`);

        // deck_cards table
        await queryRunner.query(`ALTER TABLE "deck_cards" RENAME COLUMN "is_commander" TO "isCommander"`);
        await queryRunner.query(`ALTER TABLE "deck_cards" RENAME COLUMN "color_tag" TO "colorTag"`);
        await queryRunner.query(`ALTER TABLE "deck_cards" RENAME COLUMN "scryfall_id" TO "scryfallId"`);
        await queryRunner.query(`ALTER TABLE "deck_cards" RENAME COLUMN "deck_id" TO "deckId"`);

        // cards table
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "prices_updated_at" TO "pricesUpdatedAt"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "fetched_at" TO "fetchedAt"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "card_faces" TO "cardFaces"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "price_usd_foil" TO "priceUsdFoil"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "price_usd" TO "priceUsd"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "image_png" TO "imagePng"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "image_art_crop" TO "imageArtCrop"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "image_small" TO "imageSmall"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "image_normal" TO "imageNormal"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "color_identity" TO "colorIdentity"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "oracle_text" TO "oracleText"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "type_line" TO "typeLine"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "mana_cost" TO "manaCost"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "set_name" TO "setName"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "collector_number" TO "collectorNumber"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "set_code" TO "setCode"`);
        await queryRunner.query(`ALTER TABLE "cards" DROP CONSTRAINT "PK_1d19ecc933d8be4de1bffb2d6ce"`);
        await queryRunner.query(`ALTER TABLE "cards" RENAME COLUMN "scryfall_id" TO "scryfallId"`);
        await queryRunner.query(`ALTER TABLE "cards" ADD CONSTRAINT "PK_19e3732fdb7768becc2ebc5f19a" PRIMARY KEY ("scryfallId")`);

        // decks table
        await queryRunner.query(`ALTER TABLE "decks" RENAME COLUMN "updated_at" TO "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "decks" RENAME COLUMN "created_at" TO "createdAt"`);
        await queryRunner.query(`ALTER TABLE "decks" RENAME COLUMN "color_tags" TO "colorTags"`);
        await queryRunner.query(`ALTER TABLE "decks" RENAME COLUMN "sync_error" TO "syncError"`);
        await queryRunner.query(`ALTER TABLE "decks" RENAME COLUMN "sync_status" TO "syncStatus"`);
        await queryRunner.query(`ALTER TABLE "decks" RENAME COLUMN "last_synced_at" TO "lastSyncedAt"`);
        await queryRunner.query(`ALTER TABLE "decks" RENAME COLUMN "archidekt_id" TO "archidektId"`);
        await queryRunner.query(`ALTER TABLE "decks" RENAME COLUMN "user_id" TO "userId"`);

        // users table
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "updated_at" TO "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "created_at" TO "createdAt"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "archidekt_connected_at" TO "archidektConnectedAt"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "archidekt_password" TO "archidektPassword"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "archidekt_token" TO "archidektToken"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "archidekt_email" TO "archidektEmail"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "archidekt_username" TO "archidektUsername"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "archidekt_id" TO "archidektId"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "display_name" TO "displayName"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "password_hash" TO "passwordHash"`);

        // Step 5: Recreate unique constraint on users.archidektId
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_473c8271b937b822431ef774c04" UNIQUE ("archidektId")`);

        // Step 6: Recreate indexes with old column names
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9d2e571ea70f8504d15b87f0f1" ON "deck_cards" ("deckId", "scryfallId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f9f2c37cffe9843926531654a2" ON "cards" ("setCode", "collectorNumber")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ff173be641ca715e59a584ff49" ON "collection_cards" ("userId", "scryfallId")`);

        // Step 7: Recreate foreign key constraints with old column names
        await queryRunner.query(`ALTER TABLE "deck_versions" ADD CONSTRAINT "FK_eb0c2efa04f99dd1199c3b620cd" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "decks" ADD CONSTRAINT "FK_d60e048034edfd232e0b8cedaeb" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" ADD CONSTRAINT "FK_c55a90f52ef85578ece8e9290cb" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" ADD CONSTRAINT "FK_d0320df1059d8a029a460f4161d" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deck_cards" ADD CONSTRAINT "FK_b8c9825e6c1cb080df843a99003" FOREIGN KEY ("scryfallId") REFERENCES "cards"("scryfallId") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deck_cards" ADD CONSTRAINT "FK_d738483b88c1cbcfdf84376278c" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "collection_cards" ADD CONSTRAINT "FK_73202b7bced590cc08fc2a5675f" FOREIGN KEY ("scryfallId") REFERENCES "cards"("scryfallId") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "collection_cards" ADD CONSTRAINT "FK_2619a36ae9344cab949455593e2" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
