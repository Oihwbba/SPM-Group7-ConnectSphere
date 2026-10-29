import { describe, it, expect, afterAll } from "vitest";

import { prisma } from "@/lib/db";

// SCRUM-89 — 20260912090000_event_request_details was applied to Supabase but
// never committed, then rebuilt from the live column definitions. These tests
// pin what that rebuild must produce on a database built from the repo, so a
// wrong rebuild fails here instead of surfacing later as drift from production.
// Read-only, but like every integration test they only run against a localhost
// database (CI's service container, or the Docker DB).
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

type ColumnDefinition = {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
};

describe.skipIf(!usesLocalDatabase)("SCRUM-89 — recovered event_request_details migration", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("SCRUM-89: creates the four Event columns with the same type, nullability and default as Supabase", async () => {
    // information_schema returns identifier types (`name`) the Prisma driver
    // adapter can't deserialize, so every value is cast to text.
    const columns = await prisma.$queryRaw<ColumnDefinition[]>`
      select column_name::text, data_type::text, udt_name::text, is_nullable::text, column_default::text
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'Event'
        and column_name in ('equipmentTypes', 'programme', 'registrationRequired', 'specialRequests')
      order by column_name`;

    // Values as read from the Supabase database on 2026-09-16.
    expect(columns).toEqual([
      { column_name: "equipmentTypes", data_type: "ARRAY", udt_name: "_text", is_nullable: "NO", column_default: "ARRAY[]::text[]" },
      { column_name: "programme", data_type: "text", udt_name: "text", is_nullable: "YES", column_default: null },
      { column_name: "registrationRequired", data_type: "boolean", udt_name: "bool", is_nullable: "YES", column_default: null },
      { column_name: "specialRequests", data_type: "text", udt_name: "text", is_nullable: "YES", column_default: null },
    ]);
  });

  it("SCRUM-89: records both event-detail migrations as cleanly applied, as Supabase does", async () => {
    const applied = await prisma.$queryRaw<{ migration_name: string }[]>`
      select migration_name
      from _prisma_migrations
      where migration_name in ('20260912090000_event_request_details', '20260912120000_add_programme_and_special_requests')
        and finished_at is not null
        and rolled_back_at is null
      order by migration_name`;

    expect(applied.map((row) => row.migration_name)).toEqual([
      "20260912090000_event_request_details",
      "20260912120000_add_programme_and_special_requests",
    ]);
  });
});
