import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFlowLogTable1772057339439 implements MigrationInterface {
  name = 'CreateFlowLogTable1772057339439';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "flow_logs" (
        "id" SERIAL NOT NULL, 
        "created_at" TIMESTAMP NOT NULL DEFAULT now(), 
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(), 
        "sessionId" character varying NOT NULL, 
        "userPhone" character varying NOT NULL, 
        "previous_step" character varying NOT NULL, 
        "new_step" character varying NOT NULL, 
        "action" character varying NOT NULL DEFAULT 'USER_MESSAGE', 
        "input_content" text, 
        "metadata" jsonb, 
        CONSTRAINT "PK_9a57c5a68424a13d4ead0e3211f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d5a593e8ed7918f2320e184faf" ON "flow_logs" ("sessionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e655b9790ed7219138ea8b5d03" ON "flow_logs" ("userPhone") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3be4f450b144ffd6c66837458c" ON "flow_logs" ("action") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_3be4f450b144ffd6c66837458c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e655b9790ed7219138ea8b5d03"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d5a593e8ed7918f2320e184faf"`);
    await queryRunner.query(`DROP TABLE "flow_logs"`);
  }
}
