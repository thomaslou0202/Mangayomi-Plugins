import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const checking = process.argv.includes('--check');
const fail = message => { throw new Error(message); };
const read = relative => fs.readFileSync(path.join(root, relative));
const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function https(value, field) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) fail(`${field}: expected public HTTPS URL`);
  return value;
}

function filesUnder(directory) {
  if (!fs.existsSync(path.join(root, directory))) return [];
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true })
    .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    .flatMap(entry => {
      const relative = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) fail(`Symlinks are not supported: ${relative}`);
      return entry.isDirectory() ? filesUnder(relative)
        : entry.isFile() && entry.name.endsWith('.js') ? [relative] : [];
    });
}

try {
  if (process.argv.slice(2).some(arg => arg !== '--check')) fail('Only --check is supported');
  const config = JSON.parse(read('repo.config.json').toString('utf8'));
  if (typeof config.name !== 'string' || !config.name.trim()) fail('Repository name is required');
  for (const key of ['owner', 'repository', 'branch']) {
    if (typeof config[key] !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(config[key])) {
      fail(`Invalid ${key} in repo.config.json`);
    }
  }
  const website = `https://github.com/${config.owner}/${config.repository}`;
  const rawRoot = `https://raw.githubusercontent.com/${config.owner}/${config.repository}/${config.branch}`;
  const files = [...filesUnder('javascript/novel/src'), ...filesUnder('javascript/anime/src')];
  if (!files.length) fail('No sources found');
  const entries = [];
  const ids = new Set();
  const names = new Set();

  for (const relative of files) {
    const bytes = read(relative);
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) fail(`${relative}: remove UTF-8 BOM`);
    const code = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (code.includes('\r')) fail(`${relative}: use LF line endings`);
    new vm.Script(code, { filename: relative }); // Syntax only; never execute the source body.
    const declaration = /\bconst\s+mangayomiSources\s*=\s*(\[[\s\S]*?\]);/.exec(code);
    if (!declaration || declaration[1].length > 16384) fail(`${relative}: missing/oversized metadata`);
    // Evaluate only the small source metadata literal, in an isolated context.
    const metadata = vm.runInNewContext(`(${declaration[1]})`, Object.create(null), {
      timeout: 1000, contextCodeGeneration: { strings: false, wasm: false }
    });
    if (!Array.isArray(metadata) || !metadata.length) fail(`${relative}: metadata must be a nonempty array`);

    for (const source of metadata) {
      if (!Number.isSafeInteger(source.id) || source.id <= 0 || ids.has(source.id)) fail(`${relative}: invalid/duplicate source ID`);
      if (typeof source.name !== 'string' || !source.name.trim()) fail(`${relative}: missing name`);
      if (typeof source.lang !== 'string' || !/^[a-z]{2}(?:-[a-zA-Z]{2})?$/.test(source.lang)) fail(`${relative}: invalid language`);
      const itemType = relative.startsWith('javascript/anime/') ? 1 : 2;
      const nameKey = `${itemType}:${source.lang}:${source.name}`;
      if (names.has(nameKey)) fail(`${relative}: duplicate source name/language`);
      if (source.itemType !== itemType || source.isManga !== false || source.sourceCodeLanguage !== 1 || source.typeSource !== 'single') {
        fail(`${relative}: expected native JavaScript / single source of itemType ${itemType}`);
      }
      for (const field of ['version', 'appMinVerReq']) {
        if (typeof source[field] !== 'string' || !/^\d+\.\d+\.\d+$/.test(source[field])) fail(`${relative}: invalid ${field}`);
      }
      if (source.pkgPath !== relative.replace(/^javascript\//, '')) fail(`${relative}: pkgPath does not match file`);
      if (relative.split('/').at(-2) !== source.lang) fail(`${relative}: language does not match folder`);
      for (const field of ['hasCloudflare', 'isNsfw']) {
        if (typeof source[field] !== 'boolean') fail(`${relative}: ${field} must be boolean`);
      }
      ids.add(source.id);
      names.add(nameKey);
      entries.push({
        name: source.name, id: source.id, baseUrl: https(source.baseUrl, 'baseUrl'),
        lang: source.lang, typeSource: source.typeSource, iconUrl: https(source.iconUrl, 'iconUrl'),
        dateFormat: '', dateFormatLocale: '', isNsfw: source.isNsfw,
        hasCloudflare: source.hasCloudflare, sourceCodeUrl: `${rawRoot}/${relative}`,
        apiUrl: source.apiUrl || '', version: source.version, isManga: false,
        itemType, isFullData: false, appMinVerReq: source.appMinVerReq,
        additionalParams: '', sourceCodeLanguage: 1, notes: source.notes || ''
      });
    }
  }

  entries.sort((a, b) => a.id - b.id);
  const generated = new Map([
    ['repo.json', json({ name: config.name, website })],
    ['novel_index.json', json(entries.filter(source => source.itemType === 2))],
    ['anime_index.json', json(entries.filter(source => source.itemType === 1))]
  ]);
  const integrityFiles = [...files, ...generated.keys()].sort().map(relative => ({
    path: relative, sha256: sha256(generated.get(relative) || read(relative))
  }));
  generated.set('checksums.json', json({ algorithm: 'sha256', files: integrityFiles }));
  for (const [relative, bytes] of generated) {
    if (checking) {
      if (!fs.existsSync(path.join(root, relative)) || !read(relative).equals(bytes)) {
        fail(`${relative} is stale or missing; run npm run build`);
      }
    } else {
      fs.writeFileSync(path.join(root, relative), bytes);
    }
  }
  console.log(`${checking ? 'Verified' : 'Generated'} ${entries.length} sources; syntax, IDs, metadata, paths, URLs and hashes OK.`);
  for (const source of entries) console.log(`  ${source.name} ${source.version} (ID ${source.id})`);
  for (const kind of ['novel', 'anime']) console.log(`${kind} repository URL: ${rawRoot}/${kind}_index.json`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
