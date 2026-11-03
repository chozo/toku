// 「徳を積め！」の告知動画の台本。npm run promo
// 称号には触れない（字幕・効果文字・エンドカードに書かない。ゲーム画面に映るのはよい）。
// 落とす位置は __game.autoDrop（狙った位置を通り過ぎた瞬間に落とす）で決める。

export const config = {
  slug: 'toku',
  url: 'https://game.chozo.net/toku/',
  orientation: 'portrait',
  game: { width: 360, height: 640 },
  serveDir: '.',
  gamePath: '/',
  music: false, // ゲームの BGM を使う（__game.audio.render の 'bgm'）
};

export default async function scenario(p) {
  await p.seed(3);
  await p.call('setSeed', 3);
  await p.call('audio.capture', true);

  p.on('fakeLanded', () => { p.flash({ color: '#ff3b2f', strength: 0.5 }); p.shake(10, 0.3); });

  // 0〜2.5秒 つかみ：月の高さまで積んだ塔に、もう1つ積んで「月超え！」
  await p.call('start');
  await p.call('buildTower', 71);
  await p.call('autoDrop', { offset: 0 });
  await p.skip(0.1);
  await p.call('audio.resync');
  p.zoom(1.12, 0.01, { x: 0.5, y: 0.45 });
  p.caption('徳だけで\n月まで積め！', { y: 0.1, dur: 2.3, size: 46 });
  await p.until((s, ev) => ev.some(e => e.type === 'milestone'), { max: 4 });
  p.flash({ strength: 0.6 });
  p.zoom(1, 0.6);
  await p.wait(0.9);

  // タイトル
  p.title({ title: '徳を積め！', sub: '徳を積んで\n立派な人間に成長しよう！', logo: '/public/favicon.png', dur: 2.6 });
  await p.wait(2.7);

  // 遊び方：最初から。タップで「徳」を落として積む
  await p.call('start');
  await p.call('autoDrop', { offset: 0 });
  await p.skip(0.1);
  await p.call('audio.resync');
  p.caption('タップで\n「徳」を落とす', { y: 0.1, dur: 2.2, size: 42 });
  await p.until(s => s.count >= 2, { max: 5 });
  p.speed(3);
  p.caption('ぴったり積んで\n高く高く！', { y: 0.1, dur: 2.0, size: 42 });
  await p.until(s => s.count >= 10, { max: 6 });
  p.speed(1);

  // 引っかけ：「得」「特」は見送る
  await p.call('forceNext', 'fake');
  p.caption('「得」「特」は\n見送れ！', { y: 0.1, dur: 1.8, size: 42, color: '#ffe14d' });
  p.speed(1.6, { badge: false });
  await p.until((s, ev) => ev.some(e => e.type === 'passed'), { max: 5 });
  p.speed(1);
  await p.wait(0.3);

  // どこまで積める？ 名所を次々に越える
  p.caption('どこまで積める？', { y: 0.1, dur: 4.2, size: 42 });
  for (const n of [22, 35, 58, 100, 140]) {
    await p.call('buildTower', n - 1);
    await p.skip(0.05);
    await p.call('audio.resync');
    p.flash({ strength: 0.35, dur: 0.18 });
    await p.until((s, ev) => ev.some(e => e.type === 'milestone'), { max: 3 });
    await p.wait(n === 140 ? 0.8 : 0.35);
  }

  // うっかり「得」「特」を積むと…
  await p.call('start');
  await p.call('buildTower', 30);
  await p.call('forceNext', 'fake');
  await p.call('autoDrop', { offset: 0, fake: true });
  await p.skip(0.1);
  await p.call('audio.resync');
  p.caption('うっかり積むと…', { y: 0.1, dur: 1.6, size: 42 });
  await p.until((s, ev) => ev.some(e => e.type === 'fakeLanded'), { max: 4 });
  await p.wait(1.3);
  p.caption('即終了！', { y: 0.1, dur: 2.2, size: 64, color: '#ffe14d' });
  await p.wait(2.0);

  // エンドカード：URL と QR コード
  p.endCard({ title: '徳を積め！', sub: 'スマホでもPCでも', cta: '今すぐ遊べる！', logo: 'qr.png', dur: 3.2 });
  await p.wait(3.2);
}
