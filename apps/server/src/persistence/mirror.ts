import { logger } from '@colyseus/core';
import postgres from 'postgres';
import { restoreSaves, setSaveMirror } from './homeSaves.js';

/**
 * Free hosts wipe the disk when they sleep or redeploy, so every save is also copied to Postgres
 * (ADR-020). Files stay the working copy; on boot, homes missing from disk are restored from the
 * database. Writes are queued in order and never block the game tick.
 */
export async function openMirror(url: string): Promise<{ flush: () => Promise<void> }> {
  // prepare: false also works through a connection pooler (PgBouncer, e.g. Neon "-pooler" URLs).
  const sql = postgres(url, { idle_timeout: 20, max: 1, prepare: false, onnotice: () => {} });
  await sql`create table if not exists homes (
    code text primary key,
    save jsonb not null,
    updated_at timestamptz not null default now()
  )`;
  const rows = await sql<{ code: string; save: unknown }[]>`select code, save from homes`;
  logger.info(`[saves] ${restoreSaves(rows)} of ${rows.length} homes restored from the database`);

  let queue = Promise.resolve();
  setSaveMirror((save) => {
    const json = sql.json(JSON.parse(JSON.stringify(save)) as postgres.JSONValue);
    queue = queue
      .then(async () => {
        await sql`insert into homes (code, save) values (${save.code}, ${json})
          on conflict (code) do update set save = excluded.save, updated_at = now()`;
      })
      .catch((error: unknown) => logger.error(`[saves] ${save.code} not mirrored`, error));
  });

  return {
    flush: async () => {
      await queue;
      await sql.end({ timeout: 5 });
    },
  };
}
