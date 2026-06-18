import fs from 'fs';
import { CHARACTERS } from '../src/characters.js';

const wiki = fs.readFileSync(
  'C:/Users/Мира/.cursor/projects/c-Users-Documents-Genshin-calculator/agent-tools/bcbcb2da-08bf-47d6-b193-eab28ab831b6.txt',
  'utf8',
);

const latin = /^[A-Za-z0-9 .\-']+$/;
const missing = CHARACTERS.filter((c) => c.name === c.nameRu || latin.test(c.nameRu));

for (const c of missing) {
  const escaped = c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\]\\([^)]*wiki[^)]*\\)[^\\[]*\\[${escaped}\\]`, 'i');
  const idx = wiki.search(re);
  let ru = '?';
  if (idx > 0) {
    const slice = wiki.slice(Math.max(0, idx - 80), idx);
    const m = slice.match(/\[([^\]]+)\]\([^)]*wiki/);
    if (m) ru = m[1];
  }
  console.log(`${c.id}|${c.name}|${ru}`);
}
