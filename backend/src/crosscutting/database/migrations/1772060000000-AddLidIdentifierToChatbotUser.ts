import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLidIdentifierToChatbotUser1772060000000 implements MigrationInterface {
  name = 'AddLidIdentifierToChatbotUser1772060000000';

  /**
   *
   * @todo: analisar se esta migration é necessária
   */

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chatbot_users" ADD "lid_identifier" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chatbot_users" DROP COLUMN "lid_identifier"`);
  }
}
