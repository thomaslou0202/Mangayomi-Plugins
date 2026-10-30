import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checking = process.argv.includes('--check');
try {
  const common = read('templates/native-novel-common.js');
  const dictionary = Object.create(null);
  for (const name of ['TSCharacters.txt', 'TSPhrases.txt']) {
    for (const line of read(`data/opencc/${name}`).split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const [key, values] = line.split('\t');
      if (!key || !values) throw new Error(`Malformed OpenCC dictionary: ${name}`);
      dictionary[key] = values.split(' ')[0];
    }
  }
  const maxLength = Math.max(...Object.keys(dictionary).map(key => Array.from(key).length));
  if (Object.keys(dictionary).length < 4000) throw new Error('Incomplete OpenCC data');
  const quote = value => JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  for (const name of ['sfacg', 'eightbook', 'twbook', 'qidian']) {
    let source = read(`templates/${name}.js`).replace('/*__COMMON__*/', () => common);
    if (name === 'sfacg' || name === 'qidian') source = source.replace('/*__T2S_DICT__*/', () => quote(dictionary))
      .replace('/*__T2S_MAX__*/', String(maxLength)).replace('/*__OPENCC_NOTICE__*/', () => '/*\n' + read('OPENCC-LICENSE.txt').replace(/\*\//g, '* /') + '\n*/');
    if (name === 'twbook') source = source.replace('/*__FONT_MAP__*/', () => quote(JSON.parse(read('data/twbook-f24092-map.json'))));
    if (/\/\*__[A-Z0-9_]+__\*\//.test(source)) throw new Error(`Unresolved template: ${name}`);
    const relative = `javascript/novel/src/zh/${name}.js`, file = path.join(root, relative);
    if (checking) {
      if (!fs.existsSync(file) || read(relative) !== source) throw new Error(`${relative} is stale; run npm run build`);
    } else fs.writeFileSync(file, source);
  }
  console.log(`${checking ? 'Verified' : 'Generated'} SFACG, 8book, TWBook and Qidian standalone sources.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
