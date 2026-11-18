import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261118161544 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "loyalty_entry" ("id" text not null, "customer_id" text not null, "points" integer not null, "kind" text check ("kind" in ('earn', 'redeem', 'adjust', 'revert')) not null default 'earn', "order_id" text null, "code" text null, "note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_entry_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_entry_deleted_at" ON "loyalty_entry" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_entry_customer_created" ON "loyalty_entry" ("customer_id", "created_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_loyalty_entry_order_earn_unique" ON "loyalty_entry" ("order_id") WHERE order_id IS NOT NULL AND kind = 'earn' AND deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "loyalty_entry" cascade;`);
  }

}
