import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import { expect, test } from 'vitest';
import { NEW_HOME_TIME } from '@homebound/shared';
import { SAVE_VERSION, loadHome, saveHome, setSaveDir, setSaveMirror } from './homeSaves.js';
import { openMirror } from './mirror.js';

// Needs a real database: TEST_DATABASE_URL=postgres://… npx vitest run mirror
const url = process.env.TEST_DATABASE_URL;
const CODE = 'XYZ23';

test.skipIf(!url)('saves survive a wiped disk through Postgres', async () => {
  const sql = postgres(url ?? '', { max: 1, prepare: false, onnotice: () => {} });
  let created = false;
  try {
    await sql`create table if not exists homes (code text primary key, save jsonb not null,
      updated_at timestamptz not null default now())`;
    const [taken] = await sql`select 1 from homes where code = ${CODE}`;
    if (taken) throw new Error(`${CODE} already exists in this database; not touching it`);

    created = true;
    setSaveDir(mkdtempSync(join(tmpdir(), 'homebound-mirror-a-')));
    const first = await openMirror(url ?? '');
    saveHome({
      version: SAVE_VERSION,
      code: CODE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      day: 7,
      timeOfDay: NEW_HOME_TIME,
      chest: [],
      stove: { status: 'idle', itemId: '', elapsedMs: 0, cookedBy: '' },
      resources: {},
      players: {},
      goals: [],
      today: { hunted: 0, meals: 0, gathered: 0, crafted: 0, revives: 0 },
      traps: {},
      pets: {},
      explored: [],
      discovered: [],
      caches: [],
      markers: [],
    });
    await first.flush();

    // A fresh, empty disk (the host slept): the home comes back from the database.
    setSaveDir(mkdtempSync(join(tmpdir(), 'homebound-mirror-b-')));
    const second = await openMirror(url ?? '');
    expect(loadHome(CODE)?.day).toBe(7);
    await second.flush();
  } finally {
    setSaveMirror(null);
    if (created) await sql`delete from homes where code = ${CODE}`;
    await sql.end();
  }
});
