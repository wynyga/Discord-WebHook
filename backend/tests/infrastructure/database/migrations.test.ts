import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER } from '../../../src/infrastructure/database/migrate.js';
import * as schema from '../../../src/infrastructure/database/schema.js';

interface Journal {
  entries: Array<{ idx: number; tag: string }>;
}

const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf8')) as Journal;

describe('committed migrations', () => {
  it('have a SQL file and snapshot for every journal entry', () => {
    expect(journal.entries.length).toBeGreaterThan(0);
    for (const { idx, tag } of journal.entries) {
      expect(existsSync(path.join(MIGRATIONS_FOLDER, `${tag}.sql`))).toBe(true);
      expect(existsSync(path.join(MIGRATIONS_FOLDER, 'meta', `${String(idx).padStart(4, '0')}_snapshot.json`))).toBe(
        true,
      );
    }
  });

  it('match the current schema (run `npm run db:generate` if this fails)', async () => {
    const last = journal.entries.at(-1);
    const snapshotPath = path.join(MIGRATIONS_FOLDER, 'meta', `${String(last?.idx).padStart(4, '0')}_snapshot.json`);
    const previous = JSON.parse(readFileSync(snapshotPath, 'utf8'));

    const pending = await generateMigration(previous, generateDrizzleJson(schema));

    expect(pending).toEqual([]);
  });

  it('create both tables with a JSONB payload', () => {
    const sql = journal.entries.map(({ tag }) => readFileSync(path.join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')).join();

    expect(sql).toContain('CREATE TABLE "tasks"');
    expect(sql).toContain('CREATE TABLE "task_logs"');
    expect(sql).toMatch(/"payload" jsonb NOT NULL/);
    expect(sql).toMatch(/ON DELETE cascade/);
  });
});
