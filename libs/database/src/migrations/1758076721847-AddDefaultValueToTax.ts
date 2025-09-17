import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefaultValueToTax1758076721847 implements MigrationInterface {
  name = 'AddDefaultValueToTax1758076721847';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`invoices\` CHANGE \`tax\` \`tax\` decimal(10,2) NOT NULL DEFAULT '0.00'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`invoices\` CHANGE \`tax\` \`tax\` decimal(10,2) NOT NULL`,
    );
  }
}
