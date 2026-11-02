// SNS 共有用の OGP 画像（1200×630）を作る。npm run ogp
// 1. ゲームを開き、東京タワーの手前で引っかけの「特」が揺れている場面を撮る（乱数は固定）。
// 2. 左にタイトル・遊び方・URL、右にその画面を置いた HTML を撮って public/ogp.png にする。
import { chromium } from 'playwright-core';
import { readFile, writeFile } from 'node:fs/promises';
import { serve } from '../serve.mjs';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_TEXT = 'game.chozo.net/toku';
const pub = new URL('../../public/', import.meta.url).pathname;

const server = await serve(0);
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

// 1. ゲーム画面
const game = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
await game.goto(`http://localhost:${server.address().port}/`);
await game.waitForFunction(() => window.__game);
await game.evaluate(() => document.fonts.ready);
await game.click('#btnStart');
await game.evaluate(() => {
  const g = window.__game;
  g.manual(true); g.setSeed(7); g.buildTower(21); g.forceNext('fake');
  for (let i = 0; i < 4000; i++) {
    g.step(1 / 120);
    const s = g.state();
    if (s.cur && s.cur.fake && s.cur.state === 'swing' && s.cur.x > s.topX + 30) break;
  }
});
const shot = (await game.locator('#stage').screenshot()).toString('base64');
await game.close();

// 2. 合成
const icon = (await readFile(pub + 'favicon.png')).toString('base64');
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Yuji+Syuku&family=Zen+Maru+Gothic:wght@700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; position: relative;
    background: radial-gradient(circle at 30% 40%, #fffaf0 0%, #f6e7c4 70%, #ecd29a 100%);
    font-family: "Zen Maru Gothic", sans-serif; color: #3a2410; }
  /* 右のゲーム画面の背景に、空色の帯を斜めに敷く */
  .band { position: absolute; right: -120px; top: -60px; width: 560px; height: 760px;
    background: linear-gradient(#7fc0f5, #a9d6fa); transform: rotate(8deg); }
  .shot { position: absolute; right: 70px; top: 28px; width: 322px; height: 572px; border-radius: 22px;
    border: 6px solid #fff; box-shadow: 0 18px 40px rgba(60, 30, 0, .35); transform: rotate(4deg); overflow: hidden; }
  .shot img { width: 100%; height: 100%; display: block; }
  .text { position: absolute; left: 70px; top: 0; bottom: 0; width: 700px;
    display: flex; flex-direction: column; justify-content: center; gap: 26px; }
  .logo { display: flex; align-items: center; font-family: "Yuji Syuku", serif; font-size: 112px; line-height: 1;
    white-space: nowrap; letter-spacing: 4px; }
  .logo img { width: 190px; height: 190px; margin: -20px 6px -20px -14px;
    filter: drop-shadow(0 0 22px rgba(255, 200, 60, .7)); }
  .sub { font-family: "Yuji Syuku", serif; font-size: 44px; line-height: 1.35; }
  .rule { font-size: 32px; line-height: 1.5; }
  .rule b { color: #a3171b; }
  .url { align-self: flex-start; font-size: 30px; color: #fff; background: #93181a;
    padding: 10px 28px; border-radius: 999px; letter-spacing: 1px; }
</style></head><body>
  <div class="band"></div>
  <div class="shot"><img src="data:image/png;base64,${shot}"></div>
  <div class="text">
    <div class="logo"><img src="data:image/png;base64,${icon}">を積め！</div>
    <p class="sub">徳を積んで<br>立派な人間に成長しよう！</p>
    <p class="rule">タップで「徳」を積む。<br>「<b>得</b>」「<b>特</b>」を積んだら即終了！</p>
    <p class="url">${URL_TEXT}</p>
  </div>
</body></html>`;
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: pub + 'ogp.png' });
console.log('public/ogp.png（1200×630）を書き出しました');

await browser.close();
server.close();
