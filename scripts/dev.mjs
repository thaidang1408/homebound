// Runs shared (tsc watch), server and client dev processes together.
// Plain Node instead of a runner dependency; Ctrl+C stops all of them.
import { spawn } from 'node:child_process';

const tasks = ['@homebound/shared', '@homebound/server', '@homebound/client'];

const children = tasks.map((workspace) =>
  spawn('npm', ['run', 'dev', '-w', workspace], { stdio: 'inherit', shell: true }),
);

for (const child of children) {
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      for (const other of children) other.kill();
      process.exitCode = code;
    }
  });
}
