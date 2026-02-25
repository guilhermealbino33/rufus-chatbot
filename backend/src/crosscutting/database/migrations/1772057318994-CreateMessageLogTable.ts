import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMessageLogTable1772057318994 implements MigrationInterface {
  name = 'CreateMessageLogTable1772057318994';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "message_logs" (
        "id" SERIAL NOT NULL, 
        "created_at" TIMESTAMP NOT NULL DEFAULT now(), 
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(), 
        "lead_id" integer, 
        "direction" character varying NOT NULL, 
        "content" text NOT NULL, 
        CONSTRAINT "PK_f0aae0d876a96fa1da0a1b97444" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "message_logs"`);
  }
}
