import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWhatsappSessionTable1772057271871 implements MigrationInterface {
  name = 'CreateWhatsappSessionTable1772057271871';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "whatsapp_sessions" (
        "id" SERIAL NOT NULL, 
        "created_at" TIMESTAMP NOT NULL DEFAULT now(), 
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(), 
        "session_name" character varying NOT NULL, 
        "status" character varying NOT NULL DEFAULT 'disconnected', 
        "qr_code" text, 
        "connected_at" TIMESTAMP, 
        "disconnected_at" TIMESTAMP, 
        "phone_number" character varying, 
        CONSTRAINT "UQ_5d1ad54595598137fe6fbdd2216" UNIQUE ("session_name"), 
        CONSTRAINT "PK_3d45009c99e71c709c8587ae4d6" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "whatsapp_sessions"`);
  }
}
