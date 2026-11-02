// ヘッドレス Chrome で主要な流れを確認する。npm run e2e
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { serve } from './serve.mjs';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const out = new URL('../shots/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const server = await serve(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK ' : 'NG '} ${msg}`); if (!cond) failed++; };

async function open(viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__game);
  await page.evaluate(() => document.fonts.ready);
  return { page, errors };
}

// ページ内で1コマずつ進めながら、狙いどおりに落とす
const playScript = () => {
  const g = window.__game;
  g.manual(true);
  // 次の「本物の徳」が塔の真上（+offset）に来るまで進めて落とす。ニセモノは見送る。
  g.placeNext = (offset = 0, maxSteps = 2000) => {
    for (let i = 0; i < maxSteps; i++) {
      g.step(1 / 120);
      const s = g.state();
      if (s.mode !== 'play') return 'ended';
      const c = s.cur;
      if (!c || c.state !== 'swing' || c.fake) continue;
      if (Math.abs(c.x - (s.topX + offset)) < 2.5) {
        const before = s.count;
        g.drop();
        for (let k = 0; k < 120 && g.state().cur && g.state().cur.state === 'drop'; k++) g.step(1 / 120);
        return g.state().count > before ? 'placed' : 'ended';
      }
    }
    return 'timeout';
  };
  // 結果画面が出るまで進める（崩れ落ちて散らばり終えるまで待つ）
  g.untilResult = () => {
    for (let i = 0; i < 60 * 10 && g.state().mode !== 'result'; i++) g.step(1 / 60);
    return g.state();
  };
};

// 1. スマホ縦：開始〜通しプレイ
{
  const { page, errors } = await open({ width: 360, height: 640 });
  await page.screenshot({ path: out + '01-title.png' });
  await page.click('#btnStart');
  await page.waitForTimeout(800);
  const bgm = await page.evaluate(() => { const m = window.__game.music; return { on: m.on, next: m.next }; });
  ok(bgm.on && bgm.next > 0, `開始するとBGMが鳴りはじめる（予約した拍 ${bgm.next}）`);
  await page.evaluate(playScript);
  await page.evaluate(() => window.__game.setSeed(42));
  const r = await page.evaluate(() => {
    const g = window.__game; const log = [];
    for (let i = 0; i < 22; i++) log.push(g.placeNext(0));
    const ev = g.drainEvents();
    return { ups: ev.filter(e => e.type === 'titleUp').map(e => e.title), speedUps: ev.filter(e => e.type === 'speedUp').map(e => e.ratio), log, count: g.state().count, passed: ev.filter(e => e.type === 'passed').length, ms: ev.filter(e => e.type === 'milestone').map(e => e.name) };
  });
  ok(r.count === 22, `ぴったり積んで22個（実際 ${r.count}）`);
  ok(r.passed > 0, `ニセモノを見送った回数 ${r.passed}`);
  // 得・特の出し方：10個目までは出ない、続けて出ない、何個目かで率が変わる
  const kinds = await page.evaluate(() => {
    const g = window.__game, res = {};
    for (const n of [0, 9, 10, 20, 30, 40, 50, 80]) {
      const s = g.sampleKinds(n, 20000);
      const fakes = (s.match(/f/g) || []).length;
      // 続けて出せるときに出た割合（直前が徳だった回のうちニセモノの割合）
      let chances = 0, hits = 0;
      for (let i = 1; i < s.length; i++) if (s[i - 1] === 't') { chances++; if (s[i] === 'f') hits++; }
      res[n + 1] = { fakes, double: s.includes('ff'), rate: chances ? hits / chances : 0 };
    }
    return res;
  });
  ok(kinds[1].fakes === 0 && kinds[10].fakes === 0, '10個目までは得・特が出ない');
  ok(Object.values(kinds).every(k => !k.double), '得・特は2回続けて出ない（直後は必ず徳）');
  const want = { 11: 0.10, 21: 0.15, 31: 0.20, 41: 0.25, 51: 0.30, 81: 0.30 };
  const rateOk = Object.entries(want).every(([k, p]) => Math.abs(kinds[k].rate - p) < 0.015);
  ok(rateOk, `得・特の率 ${Object.entries(want).map(([k]) => `${k}個目 ${(kinds[k].rate * 100).toFixed(1)}%`).join(' / ')}`);
  // 揺れの速さ：1〜20個目は1.0倍、そこから10個ごとに0.2倍ずつ速くなる
  const sp = await page.evaluate(() => { const g = window.__game, b = g.swingSpeed(1); return [1, 20, 21, 30, 31, 41, 51, 61, 71, 81, 91, 101].map(k => `${k}:${+(g.swingSpeed(k) / b).toFixed(2)}`).join(' '); });
  ok(sp === '1:1 20:1 21:1.2 30:1.2 31:1.4 41:1.6 51:1.8 61:2 71:2.2 81:2.4 91:2.6 101:2.8', `揺れの速さの倍率 ${sp}`);
  // 1個あたりの伸びは小さくならない（区間の平均が下がるエベレスト→旅客機の43個目だけは例外）
  const alt = await page.evaluate(() => {
    const g = window.__game, drops = [];
    for (let n = 2; n <= 160; n++) {
      const d = g.altitudeAt(n) - g.altitudeAt(n - 1), p = g.altitudeAt(n - 1) - g.altitudeAt(n - 2);
      if (d < p * 0.999) drops.push(n);
    }
    return { drops, house: g.formatAlt(g.altitudeAt(4)), five: +(g.altitudeAt(5) - g.altitudeAt(4)).toFixed(3) };
  });
  ok(alt.drops.join() === '43', `1個あたりの伸びが小さくなる所 ${alt.drops.join('、')}（43個目だけのはず）`);
  ok(alt.house === '8 m' && alt.five === 1.875, `家は${alt.house}、5個目の伸び ${alt.five} m`);
  ok(r.speedUps.join() === '1.2', `20個積むと揺れが1.2倍になったと知らせる（${r.speedUps.join('、')}）`);
  ok(r.ups.join() === '煩悩の塊,普通の人', `積む途中で称号が上がる：${r.ups.join('、')}`);
  ok(r.ms.includes('東京タワー'), `名所：${r.ms.join('、')}`);
  await page.evaluate(() => window.__game.step(1 / 60, 30));
  await page.screenshot({ path: out + '02-tower22.png' });

  // ニセモノを積むとゲームオーバー
  await page.evaluate(() => {
    const g = window.__game; g.buildTower(g.state().count); g.forceNext('fake');
    for (let i = 0; i < 2000; i++) { g.step(1 / 120); const s = g.state(); if (s.cur && s.cur.fake && s.cur.state === 'swing' && Math.abs(s.cur.x - s.topX) < 3) break; }
    g.drop(); g.step(1 / 60, 30);
  });
  await page.screenshot({ path: out + '03-fake.png' });
  const st = await page.evaluate(() => window.__game.untilResult());
  ok(st.mode === 'result' && st.endKind === 'fake', `得特を積むと終了（${st.reason}）`);
  ok(st.finalCount === 22, `結果は積めた徳の数 ${st.finalCount}`);
  const rank = await page.textContent('#rank');
  ok(rank === '普通の人', `称号 ${rank}`);
  const titles = await page.evaluate(() => [0, 10, 11, 20, 21, 30, 31, 41, 51, 61, 71, 81, 90, 91, 99, 100, 150].map(n => `${n}:${window.__game.titleAt(n)}`).join(' '));
  ok(titles === '0:極悪人 10:極悪人 11:煩悩の塊 20:煩悩の塊 21:普通の人 30:普通の人 31:ちょっといい人 41:普通にいい人 51:善人 61:修行僧並 71:住職並 81:高僧並 90:高僧並 91:聖人君子 99:聖人君子 100:ブッダ 150:ブッダ', `称号の境目 ${titles}`);
  await page.screenshot({ path: out + '04-result.png' });
  ok(!(await page.isVisible('#rNext')), '結果画面に次の目標の行がない');
  // どの称号も結果画面で1行に収まる（showResult と同じ字の大きさの決め方で測る）
  const fits = await page.evaluate(() => {
    const el = document.getElementById('rank'), box = document.getElementById('result').getBoundingClientRect(), bad = [];
    const keep = [el.textContent, el.style.fontSize];
    for (const n of [0, 11, 21, 31, 41, 51, 61, 71, 81, 91, 100]) {
      const t = window.__game.titleAt(n);
      el.textContent = t; el.style.fontSize = `${Math.min(13, 80 / t.length).toFixed(2)}cqw`;
      const r = el.getBoundingClientRect(), lh = parseFloat(getComputedStyle(el).fontSize) * 1.3;
      if (r.width > box.width * 0.92 || r.height > lh) bad.push(t);
    }
    [el.textContent, el.style.fontSize] = keep;
    return bad;
  });
  ok(fits.length === 0, `どの称号も1行に収まる ${fits.join('、')}`);

  // リトライ → 傾けて崩す
  await page.click('#btnRetry');
  const col = await page.evaluate(() => {
    const g = window.__game; const log = [];
    g.buildTower(10);
    for (let i = 0; i < 12; i++) { const r = g.placeNext(25); log.push(r); if (r !== 'placed') break; }
    g.step(1 / 60, 20);
    return { log, s: g.state() };
  });
  ok(col.s.mode === 'collapse' && col.s.endKind === 'collapse', `片側に寄せ続けると崩れる（${col.log.length}個目）`);
  await page.screenshot({ path: out + '05-collapse.png' });
  const colEnd = await page.evaluate(() => window.__game.untilResult());
  ok(colEnd.mode === 'result' && colEnd.zoom < 1 && colEnd.settled === colEnd.debris && colEnd.debris > 0,
    `崩れるとカメラを引き、崩れた徳が地面に止まる（倍率 ${colEnd.zoom.toFixed(2)}、${colEnd.settled}個）`);
  await page.screenshot({ path: out + '05b-collapse-result.png' });
  await page.click('#btnTitle');
  ok(await page.isVisible('#title'), 'タイトルへ戻る');

  // 踏み外し
  await page.click('#btnStart');
  const miss = await page.evaluate(() => { const g = window.__game; g.buildTower(5); return g.placeNext(95); });
  await page.evaluate(() => window.__game.step(1 / 60, 10));
  ok(miss === 'ended' && (await page.evaluate(() => window.__game.state().endKind)) === 'miss', '踏み外すと終了');
  ok(errors.length === 0, `ページのエラーなし ${errors.join(' / ')}`);
  await page.close();
}

// 2. 各高度の見た目
{
  const { page } = await open({ width: 360, height: 640 });
  await page.click('#btnStart');
  await page.evaluate(playScript);
  for (const n of [35, 52, 72, 90, 100, 140]) {
    await page.evaluate(n => { const g = window.__game; g.buildTower(n - 1); g.setSeed(n); g.placeNext(0); g.step(1 / 60, 40); }, n);
    await page.screenshot({ path: out + `10-alt-${n}.png` });
  }
  const s = await page.evaluate(() => window.__game.state());
  ok(s.count >= 140, `アンドロメダまで積める（${s.count}）`);
  await page.close();
}

// 3. PC 横長
{
  const { page } = await open({ width: 1280, height: 800 });
  await page.screenshot({ path: out + '20-pc-title.png' });
  const box = await page.locator('#stage').boundingBox();
  ok(Math.abs(box.height - 800) < 2 && Math.abs(box.width / box.height - 9 / 16) < 0.01, `PCで9:16に収まる ${Math.round(box.width)}x${Math.round(box.height)}`);
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? `NG ${failed}件` : 'すべてOK');
process.exit(failed ? 1 : 0);
