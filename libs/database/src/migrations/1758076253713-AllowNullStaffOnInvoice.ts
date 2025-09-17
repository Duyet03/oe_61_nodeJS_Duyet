import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowNullStaffOnInvoice1758076253713
  implements MigrationInterface
{
  name = 'AllowNullStaffOnInvoice1758076253713';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`invoices\` DROP FOREIGN KEY \`FK_14853296d168c36b2fb96c23fa5\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`invoices\` CHANGE \`staff_id\` \`staff_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`invoices\` ADD CONSTRAINT \`FK_14853296d168c36b2fb96c23fa5\` FOREIGN KEY (\`staff_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`invoices\` DROP FOREIGN KEY \`FK_14853296d168c36b2fb96c23fa5\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`invoices\` CHANGE \`staff_id\` \`staff_id\` int NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`invoices\` ADD CONSTRAINT \`FK_14853296d168c36b2fb96c23fa5\` FOREIGN KEY (\`staff_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
