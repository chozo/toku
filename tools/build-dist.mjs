// 公開用ファイルを dist/toku/ に書き出す（index.html・style.css・game.js と public/ の中身）
// 使い方: npm run build
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'toku');
fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'style.css', 'game.js']) fs.copyFileSync(path.join(root, f), path.join(out, f));
fs.cpSync(path.join(root, 'public'), out, { recursive: true });
console.log(fs.readdirSync(out).map(f => `dist/toku/${f}`).join('\n'));
