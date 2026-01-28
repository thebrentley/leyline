import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1769481839420 implements MigrationInterface {
    name = 'InitialSchema1769481839420'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "collection_cards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "scryfallId" character varying NOT NULL, "quantity" integer NOT NULL, "foilQuantity" integer NOT NULL DEFAULT '0', "originalPriceUsd" numeric(10,2), "originalPriceUsdFoil" numeric(10,2), "linkedDeckCard" jsonb, "addedAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_543a8393c7b5f1783fc8b112bf0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ff173be641ca715e59a584ff49" ON "collection_cards" ("userId", "scryfallId") `);
        await queryRunner.query(`CREATE TABLE "cards" ("scryfallId" character varying NOT NULL, "name" character varying NOT NULL, "setCode" character varying NOT NULL, "collectorNumber" character varying NOT NULL, "setName" character varying NOT NULL, "manaCost" character varying, "cmc" numeric(4,1), "typeLine" character varying NOT NULL, "oracleText" text, "colors" text array NOT NULL DEFAULT '{}', "colorIdentity" text array NOT NULL DEFAULT '{}', "power" character varying, "toughness" character varying, "loyalty" character varying, "rarity" character varying NOT NULL, "imageNormal" text, "imageSmall" text, "imageArtCrop" text, "imagePng" text, "priceUsd" numeric(10,2), "priceUsdFoil" numeric(10,2), "layout" character varying, "cardFaces" jsonb, "fetchedAt" TIMESTAMP NOT NULL DEFAULT now(), "pricesUpdatedAt" TIMESTAMP, CONSTRAINT "PK_19e3732fdb7768becc2ebc5f19a" PRIMARY KEY ("scryfallId"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f9f2c37cffe9843926531654a2" ON "cards" ("setCode", "collectorNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_6077bbed1f2d46517bb4f77d13" ON "cards" ("name") `);
        await queryRunner.query(`CREATE TABLE "deck_cards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "deckId" uuid NOT NULL, "scryfallId" character varying NOT NULL, "quantity" integer NOT NULL, "colorTag" character varying, "categories" text array NOT NULL DEFAULT '{}', "isCommander" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_7143f21b3e36f538a75d3019f52" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9d2e571ea70f8504d15b87f0f1" ON "deck_cards" ("deckId", "scryfallId") `);
        await queryRunner.query(`CREATE TABLE "chat_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "deckId" uuid NOT NULL, "name" character varying NOT NULL, "messages" jsonb NOT NULL DEFAULT '[]', "pendingChanges" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_efc151a4aafa9a28b73dedc485f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "decks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "archidektId" integer NOT NULL, "name" character varying NOT NULL, "format" character varying, "description" text, "lastSyncedAt" TIMESTAMP, "syncStatus" character varying NOT NULL DEFAULT 'pending', "syncError" text, "colorTags" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_981894e3f8dbe5049ac59cb1af1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "displayName" character varying, "archidektId" integer, "archidektUsername" text, "archidektEmail" text, "archidektToken" text, "archidektPassword" text, "archidektConnectedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_473c8271b937b822431ef774c04" UNIQUE ("archidektId"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "deck_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "deckId" uuid NOT NULL, "versionNumber" integer NOT NULL, "description" character varying, "changeType" character varying NOT NULL, "cards" jsonb NOT NULL, "colorTags" jsonb NOT NULL DEFAULT '[]', "cardCount" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d227bdb86e0baa32bc11b38cd49" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "collection_cards" ADD CONSTRAINT "FK_2619a36ae9344cab949455593e2" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "collection_cards" ADD CONSTRAINT "FK_73202b7bced590cc08fc2a5675f" FOREIGN KEY ("scryfallId") REFERENCES "cards"("scryfallId") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deck_cards" ADD CONSTRAINT "FK_d738483b88c1cbcfdf84376278c" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deck_cards" ADD CONSTRAINT "FK_b8c9825e6c1cb080df843a99003" FOREIGN KEY ("scryfallId") REFERENCES "cards"("scryfallId") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" ADD CONSTRAINT "FK_d0320df1059d8a029a460f4161d" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" ADD CONSTRAINT "FK_c55a90f52ef85578ece8e9290cb" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "decks" ADD CONSTRAINT "FK_d60e048034edfd232e0b8cedaeb" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deck_versions" ADD CONSTRAINT "FK_eb0c2efa04f99dd1199c3b620cd" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "deck_versions" DROP CONSTRAINT "FK_eb0c2efa04f99dd1199c3b620cd"`);
        await queryRunner.query(`ALTER TABLE "decks" DROP CONSTRAINT "FK_d60e048034edfd232e0b8cedaeb"`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" DROP CONSTRAINT "FK_c55a90f52ef85578ece8e9290cb"`);
        await queryRunner.query(`ALTER TABLE "chat_sessions" DROP CONSTRAINT "FK_d0320df1059d8a029a460f4161d"`);
        await queryRunner.query(`ALTER TABLE "deck_cards" DROP CONSTRAINT "FK_b8c9825e6c1cb080df843a99003"`);
        await queryRunner.query(`ALTER TABLE "deck_cards" DROP CONSTRAINT "FK_d738483b88c1cbcfdf84376278c"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" DROP CONSTRAINT "FK_73202b7bced590cc08fc2a5675f"`);
        await queryRunner.query(`ALTER TABLE "collection_cards" DROP CONSTRAINT "FK_2619a36ae9344cab949455593e2"`);
        await queryRunner.query(`DROP TABLE "deck_versions"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "decks"`);
        await queryRunner.query(`DROP TABLE "chat_sessions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9d2e571ea70f8504d15b87f0f1"`);
        await queryRunner.query(`DROP TABLE "deck_cards"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6077bbed1f2d46517bb4f77d13"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f9f2c37cffe9843926531654a2"`);
        await queryRunner.query(`DROP TABLE "cards"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ff173be641ca715e59a584ff49"`);
        await queryRunner.query(`DROP TABLE "collection_cards"`);
    }

}
