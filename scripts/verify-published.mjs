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
  const indexes = await Promise.all([['manga', 0, 'index.json'], ['novel', 2, 'novel_index.json'], ['anime', 1, 'anime_index.json']].map(async ([kind, itemType, filename]) => {
    const bytes = await fetchBytes(`${base}/${filename}`);
    const entries = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (bytes[0] !== 0x5b || !Array.isArray(entries) || entries.some(entry => entry.itemType !== itemType)) throw new Error(`${kind} index is not a native array of itemType ${itemType}`);
    if (!bytes.equals(local(filename))) throw new Error(`Published ${kind} metadata differs from local files; push changes or wait for GitHub raw cache`);
    return {kind, count: entries.length};
  }));
  if (!(await fetchBytes(`${base}/repo.json`)).equals(local('repo.json'))) throw new Error('Published repo metadata differs from local files');
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
  for (const index of indexes) console.log(`Public ${index.kind} install URL verified; ${index.count} sources accessible without login.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
