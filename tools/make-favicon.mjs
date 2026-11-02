// プレイ中と同じ立体の「徳」を、背景透過のファビコンにする。npm run favicon
// ゲームの glyphSprites（字の正面・側面・縁の画像）を使い、drawBlock と同じ重ね方で描く。
// 出力: public/favicon.png（192×192）と public/favicon.svg（同じ絵を埋め込んだ SVG）
import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
import { serve } from './serve.mjs';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SIZE = 192;
const pub = new URL('../public/', import.meta.url).pathname;

const server = await serve(0);
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForFunction(() => window.__game);
await page.evaluate(() => document.fonts.ready);

const dataUrl = await page.evaluate(size => {
  glyphCache.clear();                       // フォント読み込み後に作り直す
  const sp = glyphSprites('徳', 'gold');
  const cw = BW + GLYPH_PAD * 2, chh = BH + GLYPH_PAD * 2;
  const offX = GLYPH_DEPTH * Math.sin(0.6), offY = -GLYPH_DEPTH * 0.7;
  // 厚みを含めた絵の範囲（字の箱＋縁取りの余白＋奥へのずれ）が正方形に収まるよう縮める
  const w = BW + offX + 6, h = BH - offY + 6;
  const k = size / Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.translate(size / 2, size / 2);
  x.scale(k, k);
  x.translate(-offX / 2, -offY / 2);        // 厚みの分だけ中心をずらす
  for (let i = GLYPH_LAYERS; i >= 1; i--) {
    const f = i / GLYPH_LAYERS;
    x.drawImage(i === 1 ? sp.edge : sp.side, offX * f - cw / 2, offY * f - chh / 2, cw, chh);
  }
  x.drawImage(sp.face, -cw / 2, -chh / 2, cw, chh);
  return c.toDataURL('image/png');
}, SIZE);

const png = Buffer.from(dataUrl.split(',')[1], 'base64');
await writeFile(pub + 'favicon.png', png);
await writeFile(pub + 'favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${SIZE} ${SIZE}">` +
  `<image width="${SIZE}" height="${SIZE}" href="${dataUrl}" xlink:href="${dataUrl}"/></svg>\n`);
console.log(`public/favicon.png（${png.length} bytes）と public/favicon.svg を書き出しました`);

await browser.close();
server.close();
