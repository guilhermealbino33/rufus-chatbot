import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatbotUserTable1772057299415 implements MigrationInterface {
  name = 'CreateChatbotUserTable1772057299415';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "chatbot_users" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "phoneNumber" character varying NOT NULL, "name" character varying, "currentStep" character varying NOT NULL DEFAULT 'START', "contextData" jsonb NOT NULL DEFAULT '{}', "last_interaction_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0b107eeed92574abab9786afaae" UNIQUE ("phoneNumber"), CONSTRAINT "PK_aa7b48eaf26d65b85b297e4897f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0b107eeed92574abab9786afaa" ON "chatbot_users" ("phoneNumber") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6323a1f25377a6ce576a0bb9c2" ON "chatbot_users" ("currentStep") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_6323a1f25377a6ce576a0bb9c2"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0b107eeed92574abab9786afaa"`);
    await queryRunner.query(`DROP TABLE "chatbot_users"`);
  }
}
