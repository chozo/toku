// 名所ごとの見え方を撮る（目標に近づいたところ・越えた直後）。shots/lm-*.png
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { serve } from './serve.mjs';

const out = new URL('../shots/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const server = await serve(0);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForFunction(() => window.__game);
await page.evaluate(() => document.fonts.ready);
await page.click('#btnStart');
const list = await page.evaluate(() => window.__game.milestones.filter(m => m.draw).map(m => [m.n, m.draw]));
const only = process.argv[2];
for (const [n, name] of list) {
  if (only && !only.split(',').includes(name)) continue;
  for (const [tag, k] of [['near', n - 2], ['far', n - 4], ['clear', n]]) {
    if (k < 0) continue;
    await page.evaluate(k => { const g = window.__game; g.manual(true); g.buildTower(k); g.step(1 / 60, 1); g.step(1 / 60, 90); }, k);
    if (tag === 'clear') await page.evaluate(n => { const g = window.__game; g.buildTower(n - 1); g.forceNext('toku'); g.step(1 / 120, 60);
      for (let i = 0; i < 3000; i++) { const s = g.state(); if (s.cur && s.cur.state === 'swing' && !s.cur.fake && Math.abs(s.cur.x - s.topX) < 3) break; g.step(1 / 120); }
      g.drop(); g.step(1 / 60, 40); }, n);
    await page.screenshot({ path: `${out}lm-${String(n).padStart(3, '0')}-${name}-${tag}.png` });
  }
}
console.log(errors.length ? errors : 'エラーなし');
await browser.close(); server.close();
