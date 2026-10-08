// Guided deploy (ADR-020). The browser steps (sign-ups, logins, Render) stay with you; this does the rest.
// Usage: npm run deploy -- db | server | client | check
// Settings are kept in the git-ignored .env as DEPLOY_* (never DATABASE_URL: local dev must not
// write into the production database).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const ENV_FILE = new URL('../.env', import.meta.url);
const NEON_REGION = 'aws-ap-southeast-1'; // Singapore, like the Render service
const PAGES_PROJECT = 'homebound-wild-world';
const NEONCTL = 'neonctl@8';
const WRANGLER = 'wrangler@4';

const isWindows = process.platform === 'win32';

function readEnv() {
  if (!existsSync(ENV_FILE)) return {};
  return Object.fromEntries(
    readFileSync(ENV_FILE, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
}

/** Sets one key in .env, keeping every other line as it is. */
function setEnv(key, value) {
  const text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  const next = re.test(text)
    ? text.replace(re, line)
    : `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`;
  writeFileSync(ENV_FILE, next);
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: isWindows, ...opts });
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`);
  return res;
}

const npx = (args, opts) => run('npx', ['-y', ...args], opts);
const capture = (args) =>
  execFileSync('npx', ['-y', ...args], {
    encoding: 'utf8',
    shell: isWindows,
    stdio: ['inherit', 'pipe', 'inherit'],
  });

function copy(text) {
  try {
    execFileSync(isWindows ? 'clip' : 'pbcopy', { input: text });
    return true;
  } catch {
    return false;
  }
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q) => (await rl.question(`\n👉 ${q}`)).trim();
const say = (text) => console.log(`\n${text}`);

async function db() {
  say(
    '[1/2] Logging in to Neon: a browser tab opens. Sign up / log in (GitHub works), then come back.',
  );
  npx([NEONCTL, 'auth']);
  say('[2/2] Creating the Neon project "homebound" in Singapore…');
  const created = capture([
    NEONCTL,
    'projects',
    'create',
    '--name',
    'homebound',
    '--region-id',
    NEON_REGION,
    '--output',
    'json',
  ]);
  // Take the first connection string in the output, whatever the CLI version's JSON shape.
  const url = created.match(/postgres(?:ql)?:\/\/[^"\s]+/)?.[0];
  if (!url)
    throw new Error('Neon did not return a connection string; copy it from console.neon.tech');
  setEnv('DEPLOY_DATABASE_URL', url);
  say('✅ Database ready. Saved to .env as DEPLOY_DATABASE_URL (git-ignored, not printed here).');
  say('Testing a real save round-trip against it…');
  run('npx', ['vitest', 'run', 'apps/server/src/persistence/mirror'], {
    env: { ...process.env, TEST_DATABASE_URL: url },
  });
  say('Next: npm run deploy -- server');
}

async function server() {
  const { DEPLOY_DATABASE_URL: url } = readEnv();
  if (!url) throw new Error('Run "npm run deploy -- db" first.');
  say(`Render can only be set up in the browser. Do this:
  1. Open https://dashboard.render.com and sign up with GitHub.
  2. New → Blueprint → connect GitHub, allow the "homebound" repo → pick it → Connect.
     (Render reads render.yaml: service "homebound-server", free plan, Singapore.)
  3. It asks for DATABASE_URL: paste (Ctrl+V) — ${copy(url) ? 'already copied to your clipboard' : 'it is DEPLOY_DATABASE_URL in .env'}.
     Leave ALLOWED_ORIGINS empty for now → Apply / Deploy Blueprint.
  4. Wait for "Live" (3–5 min), then copy the service URL at the top (https://….onrender.com).`);
  const serverUrl = (await ask('Paste the Render URL: ')).replace(/\/$/, '');
  if (!/^https:\/\/[\w.-]+\.onrender\.com$/.test(serverUrl))
    throw new Error(`Not a Render URL: ${serverUrl}`);
  setEnv('DEPLOY_SERVER_URL', serverUrl);
  const res = await fetch(`${serverUrl}/health`).catch(() => null);
  say(res?.ok ? '✅ Server is up.' : '⚠️ /health did not answer yet; check Render → Logs.');
  say('Next: npm run deploy -- client');
}

async function client() {
  const { DEPLOY_SERVER_URL: serverUrl } = readEnv();
  if (!serverUrl) throw new Error('Run "npm run deploy -- server" first.');
  say('[1/3] Building the client for ' + serverUrl);
  run('npm', ['run', 'build', '-w', '@homebound/shared']);
  run('npm', ['run', 'build', '-w', '@homebound/client'], {
    env: { ...process.env, VITE_SERVER_URL: serverUrl },
  });
  say(
    '[2/3] Logging in to Cloudflare: a browser tab opens. Sign up / log in, click Allow, come back.',
  );
  npx([WRANGLER, 'login']);
  // Creating an existing project fails harmlessly on re-runs.
  spawnSync(
    'npx',
    ['-y', WRANGLER, 'pages', 'project', 'create', PAGES_PROJECT, '--production-branch', 'main'],
    {
      stdio: 'inherit',
      shell: isWindows,
    },
  );
  say('[3/3] Uploading…');
  const out = capture([
    WRANGLER,
    'pages',
    'deploy',
    'apps/client/dist',
    '--project-name',
    PAGES_PROJECT,
    '--branch',
    'main',
    '--commit-dirty=true',
  ]);
  console.log(out);
  // "https://<hash>.<project>.pages.dev" → production URL "https://<project>.pages.dev"
  const host = out.match(/https:\/\/[\w-]+\.([\w-]+\.pages\.dev)/)?.[1];
  const pagesUrl = host ? `https://${host}` : await ask('Paste the https://….pages.dev URL: ');
  setEnv('DEPLOY_PAGES_URL', pagesUrl);
  say(`✅ Game uploaded: ${pagesUrl}
Last browser step — Render dashboard → homebound-server → Environment:
  ALLOWED_ORIGINS = ${pagesUrl}   (${copy(pagesUrl) ? 'copied to your clipboard' : 'copy it from here'})
→ Save Changes (Render redeploys, ~2 min). Then: npm run deploy -- check`);
}

async function check() {
  const { DEPLOY_SERVER_URL: serverUrl, DEPLOY_PAGES_URL: pagesUrl } = readEnv();
  if (!serverUrl || !pagesUrl) throw new Error('Run the server and client steps first.');
  const health = await fetch(`${serverUrl}/health`).catch(() => null);
  const cors = (origin) =>
    fetch(`${serverUrl}/matchmake/create/home`, { method: 'OPTIONS', headers: { Origin: origin } })
      .then((r) => r.headers.get('access-control-allow-origin'))
      .catch(() => null);
  const page = await fetch(pagesUrl).catch(() => null);
  const results = [
    ['Server /health', health?.ok],
    ['Game page loads', page?.ok],
    ['Game page allowed (CORS)', (await cors(pagesUrl)) === pagesUrl],
    [
      'Other websites refused (CORS)',
      (await cors('https://example.com')) !== 'https://example.com',
    ],
  ];
  for (const [name, ok] of results) console.log(`${ok ? '✅' : '❌'} ${name}`);
  if (results.every(([, ok]) => ok))
    say(
      `All good. Open ${pagesUrl} on two laptops: one builds a home, the other joins with the code.`,
    );
  else
    say(
      'Something is off: a sleeping server can take a minute (run again), or ALLOWED_ORIGINS is not saved on Render yet.',
    );
}

const steps = { db, server, client, check };
const step = steps[process.argv[2]];
try {
  if (!step) throw new Error('Usage: npm run deploy -- db | server | client | check');
  await step();
} catch (error) {
  console.error(`\n❌ ${error.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
