import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const local = relative => fs.readFileSync(path.join(root, relative));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function fetchBytes(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), cache: 'no-store' });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

try {
  for (const script of ['scripts/build-sources.mjs', 'scripts/build-index.mjs']) {
    const check = spawnSync(process.execPath, [script, '--check'], { cwd: root, stdio: 'inherit' });
    if (check.status !== 0) throw new Error('Local repository check failed');
  }
  const config = JSON.parse(local('repo.config.json'));
  const base = `https://raw.githubusercontent.com/${config.owner}/${config.repository}/${config.branch}`;
  const [indexBytes, repoBytes] = await Promise.all([
    fetchBytes(`${base}/novel_index.json`), fetchBytes(`${base}/repo.json`)
  ]);
  const index = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(indexBytes));
  if (indexBytes[0] !== 0x5b || !Array.isArray(index)) throw new Error('Index is not a native Mangayomi JSON array');
  if (!indexBytes.equals(local('novel_index.json')) || !repoBytes.equals(local('repo.json'))) {
    throw new Error('Published metadata differs from local files; push changes or wait for GitHub raw cache');
  }
  const integrity = JSON.parse(local('checksums.json'));
  const results = await Promise.allSettled(integrity.files.map(async item => {
    const bytes = await fetchBytes(`${base}/${item.path}`);
    if (sha256(bytes) !== item.sha256) throw new Error(`Published hash mismatch: ${item.path}`);
    return item.path;
  }));
  for (const result of results) {
    if (result.status === 'rejected') throw result.reason;
    console.log(`Published OK: ${result.value}`);
  }
  console.log(`Public install URL verified; ${index.length} sources accessible without login.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
