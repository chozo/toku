'use strict';

// ===== 調整値 =====
const CONFIG = {
  W: 360, H: 640,
  BW: 80, BH: 70,            // 徳の字の幅・高さ（当たり判定、論理px）
  groundScreenY: 560,        // 開始時の地面の画面上の位置
  towerTopScreenY: 330,      // カメラが追う「塔の頂上」の画面上の位置
  platformW: 220,            // 土台の幅
  hoverGap: 170,             // 揺れているブロックの下端と塔の頂上の距離
  swingAmp: 118,             // 左右の振れ幅
  swingBase: 2.0,            // 揺れの速さ（rad/s）
  swingPerBlock: 0.045,      // 1個積むごとに速くなる分
  swingMax: 4.6,             // ここまでで頭打ち（60個目あたり）
  swingStepFrom: 61,         // この個数目から、さらに段階的に速くする
  swingStepEvery: 10,        // 何個ごとに速くするか
  swingStepRate: 0.08,       // 1段階ごとに速くなる割合（0.08 で 8%）
  gravity: 2600,
  perfect: 10,               // この距離以内ならぴったり扱いで真上にそろえる
  stickiness: 1.15,          // 重心のずれが「支えの半幅 × この値」を超えると崩れる
  minOverlap: 10,            // これより重なりが少ないと踏み外し
  // ニセモノ（得・特）の出る率。from は「何個目の字か」。10個目までは出ない。
  // ニセモノのあとは必ず徳を出す（2回続けては出ない）。
  fakeRates: [
    { from: 11, p: 0.10 },
    { from: 21, p: 0.15 },
    { from: 31, p: 0.20 },
    { from: 41, p: 0.25 },
    { from: 51, p: 0.30 },
  ],
  fakeLife: 1.9,             // ニセモノが揺れている時間（秒）
  wobbleWarn: 0.72,          // 重心のずれがこの割合を超えるとグラグラ表示
  // 崩れたとき
  debrisGravity: 0.55,       // 崩れた字にかかる重力（gravity に対する割合）
  collapseSpread: 0.24,      // 崩れた字が横へ散らばる強さ（1 で塔の高さと同じくらいの距離）
  spreadMax: 420,            // 横へ飛ぶ速さの上限（高い塔でも散らばりすぎないように）
  pullBackTime: 0.7,         // カメラを引ききるまでの秒数
  pullTopY: 140,             // 引いたときの塔の頂上の画面上の位置
  pullGroundY: 606,          // 引いたときの地面の画面上の位置
  resultAfterSettle: 1.1,    // 散らばり終えてから結果を出すまでの秒数
  resultMax: 7,              // 崩れはじめてから結果を出すまでの最長の秒数
  // 塔の傾き（見た目だけ。判定は stability で行う）
  fakeShowTime: 1.9,         // 得・特を積んだとき、崩れる前に強調して見せる秒数
  leanPerLevel: 0.15,        // 重心のずれが限界ちょうどの段で、その上の字が傾く角度（rad）
  leanMax: 0.4,              // 傾きの上限（rad）
};
const FAKES = ['得', '特'];

// 称号：積んだ徳の数で決まる（名所とは別）。from 個以上でその称号。
const TITLES = [
  { from: 0,   title: '極悪人' },
  { from: 11,  title: '煩悩の塊' },
  { from: 21,  title: '普通の人' },
  { from: 31,  title: 'ちょっといい人' },
  { from: 41,  title: '普通にいい人' },
  { from: 51,  title: '善人' },
  { from: 61,  title: '修行僧並' },
  { from: 71,  title: '住職並' },
  { from: 81,  title: '高僧並' },
  { from: 91,  title: '聖人君子' },
  { from: 100, title: 'ブッダ' },
];
function titleAt(n) {
  let r = TITLES[0];
  for (const t of TITLES) if (n >= t.from) r = t;
  return r.title;
}

// 名所：n 個積むとその高さ（m）に届く。高さの決め方は ALT_TABLE を参照。
const MILESTONES = [
  { n: 0,   m: 0,        name: '地面',             draw: null },
  { n: 4,   m: 7.5,      name: '二階建ての家',     draw: 'house' },
  { n: 8,   m: 15,       name: '奈良の大仏',       draw: 'buddha' },
  { n: 12,  m: 55,       name: '五重塔',           draw: 'pagoda' },
  { n: 17,  m: 147,      name: '高層ビル',         draw: 'building' },
  { n: 22,  m: 333,      name: '東京タワー',       draw: 'tokyotower' },
  { n: 28,  m: 634,      name: 'スカイツリー',     draw: 'skytree' },
  { n: 35,  m: 3776,     name: '富士山',           draw: 'fuji' },
  { n: 42,  m: 8849,     name: 'エベレスト',       draw: 'everest' },
  { n: 46,  m: 10000,    name: '旅客機',           draw: 'plane' },
  { n: 52,  m: 50000,    name: '成層圏',           draw: 'stratosphere' },
  { n: 58,  m: 4.0e5,    name: '宇宙ステーション', draw: 'iss' },
  { n: 65,  m: 3.5786e7, name: '静止衛星',         draw: 'satellite' },
  { n: 72,  m: 3.844e8,  name: '月',               draw: 'moon' },
  // 惑星は、地球にいちばん近づいたときの平均的な距離
  { n: 80,  m: 7.8e10,   name: '火星',             draw: 'mars' },
  { n: 90,  m: 6.3e11,   name: '木星',             draw: 'jupiter' },
  { n: 100, m: 1.28e12,  name: '土星',             draw: 'saturn' },
  { n: 110, m: 2.72e12,  name: '天王星',           draw: 'uranus' },
  { n: 120, m: 4.35e12,  name: '海王星',           draw: 'neptune' },
  // 天の川銀河の反対側の端（約7.6万光年）、アンドロメダ（約250万光年）、観測できる宇宙の果て（約465億光年）
  { n: 130, m: 7.2e20,   name: '天の川銀河の果て', draw: 'galaxy' },
  { n: 140, m: 2.4e22,   name: 'アンドロメダ星雲', draw: 'andromeda' },
  { n: 150, m: 4.4e26,   name: '宇宙の果て',       draw: 'edge' },
];

// n 個目までの高さを、名所の高さを通る表にしておく（ALT_TABLE[n]）。
// 区間ごとに別々の曲線でつなぐと、名所を越えた直後に1個あたりの伸びが一度小さくなる。
// そこで1個あたりの伸びを直接決める。名所の位置での伸びを「左右の区間の平均の伸び」の相乗平均とし、
// 区間の中では始めの値から終わりの値へ単調に変化させ、合計が名所の高さの差にぴったり合うよう形を調整する。
// こうすると、区間の平均の伸びが前の区間より小さい所（エベレスト→旅客機）以外は、伸びが小さくならない。
// 家（4個・7.5 m、表示は 8 m）と大仏（8個・15 m）までは1個あたり同じ 1.875 m。
const ALT_TABLE = (() => {
  const M = MILESTONES, segs = M.length - 1;
  const avg = M.slice(0, -1).map((a, i) => (M[i + 1].m - a.m) / (M[i + 1].n - a.n));
  const T = [0];
  for (let i = 0; i < segs; i++) {
    const k = M[i + 1].n - M[i].n, D = M[i + 1].m - M[i].m, mean = avg[i];
    // 区間の始めと終わりの伸び（前後の区間の平均との相乗平均。平均が下がる所では平均のまま）
    const s = i === 0 || avg[i - 1] > mean ? mean : Math.sqrt(avg[i - 1] * mean);
    const e = i === segs - 1 ? mean * mean / s : (avg[i + 1] < mean ? mean : Math.sqrt(mean * avg[i + 1]));
    const at = (p, j) => s * Math.pow(e / s, Math.pow((j + 0.5) / k, p));
    const sum = p => { let t = 0; for (let j = 0; j < k; j++) t += at(p, j); return t; };
    let p = 1;
    if (e > s * 1.0001 && mean > s * 1.0001) {
      // p が大きいほど始めの値に長くとどまる（合計が小さくなる）
      let lo = 1e-4, hi = 1e4;
      for (let it = 0; it < 80; it++) { p = Math.sqrt(lo * hi); if (sum(p) > D) lo = p; else hi = p; }
    } else p = Infinity;
    const d = [];
    for (let j = 0; j < k; j++) d.push(p === Infinity ? mean : at(p, j));
    const scale = D / d.reduce((x, y) => x + y, 0);
    for (let j = 0; j < k; j++) T.push(T[T.length - 1] + d[j] * scale);
    T[T.length - 1] = M[i + 1].m;
  }
  // 最後の名所より先は、最後の区間の終わりの比率で伸び続ける
  const end = T.length - 1;
  T.growth = T[end] / T[end - 1];
  return T;
})();

function altitudeAt(n) {
  if (n <= 0) return 0;
  const T = ALT_TABLE, end = T.length - 1;
  if (n >= end) return T[end] * Math.pow(T.growth, n - end);
  const i = Math.floor(n), t = n - i;
  return T[i] + (T[i + 1] - T[i]) * t;
}

function formatAlt(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  if (km < 10000) return `${km < 100 ? km.toFixed(1) : Math.round(km).toLocaleString('ja-JP')} km`;
  const man = km / 1e4;
  if (man < 10000) return `${man < 100 ? man.toFixed(1) : Math.round(man).toLocaleString('ja-JP')}万 km`;
  const oku = km / 1e8;
  if (oku < 10000) return `${oku < 100 ? oku.toFixed(1) : Math.round(oku).toLocaleString('ja-JP')}億 km`;
  const cho = km / 1e12;
  if (cho < 10000) return `${cho < 100 ? cho.toFixed(1) : Math.round(cho).toLocaleString('ja-JP')}兆 km`;
  const kei = km / 1e16;
  if (kei < 10000) return `${kei < 100 ? kei.toFixed(1) : Math.round(kei).toLocaleString('ja-JP')}京 km`;
  const gai = km / 1e20;
  return `${gai < 100 ? gai.toFixed(1) : Math.round(gai).toLocaleString('ja-JP')}垓 km`;
}

function reachedMilestone(n) {
  let r = MILESTONES[0];
  for (const m of MILESTONES) if (n >= m.n) r = m;
  return r;
}
function nextMilestone(n) {
  return MILESTONES.find(m => m.n > n) || null;
}

// ===== 描画の準備 =====
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const { W, H, BW, BH } = CONFIG;
let dpr = 1;
function resize() {
  const rect = cv.getBoundingClientRect();
  dpr = Math.min(2.5, (rect.width / W) * (window.devicePixelRatio || 1));
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  if (typeof lmCache !== 'undefined') lmCache.clear();
}
window.addEventListener('resize', resize);

const KANJI_FONT = '"Yuji Syuku", "Hiragino Mincho ProN", "Yu Mincho", serif';
const UI_FONT = '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif';

// ===== 乱数（確認用に固定できる） =====
let seed = 0;
let rand = Math.random;
function setSeed(s) {
  seed = s >>> 0;
  rand = () => {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ===== 音（Web Audio で合成） =====
const Sound = {
  ac: null, master: null, enabled: true,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ac.destination);
    } catch (e) { this.ac = null; }
  },
  tone(freq, dur, { type = 'sine', vol = 0.3, attack = 0.003, delay = 0, slide = 0 } = {}) {
    if (!this.ac || !this.enabled) return;
    const t0 = this.ac.currentTime + delay;
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  noise(dur, { vol = 0.3, freq = 800, q = 1, type = 'bandpass', delay = 0, sweep = 0 } = {}) {
    if (!this.ac || !this.enabled) return;
    const t0 = this.ac.currentTime + delay;
    const len = Math.ceil(this.ac.sampleRate * dur);
    const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    const f = this.ac.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t0 + dur);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  },
  // 木魚（ぽく）
  moku(pitch = 1) {
    this.tone(720 * pitch, 0.09, { type: 'triangle', vol: 0.5 });
    this.tone(1180 * pitch, 0.05, { type: 'sine', vol: 0.18 });
    this.noise(0.03, { vol: 0.15, freq: 2500, q: 2 });
  },
  // おりん（ちーん）
  rin(vol = 0.22) {
    [1320, 3560, 5270].forEach((f, i) => this.tone(f, 2.2 - i * 0.5, { vol: vol / (i + 1), attack: 0.002 }));
  },
  fanfare() {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.18, delay: i * 0.09 }));
    this.rin(0.15);
  },
  buzzer() {
    this.tone(150, 0.55, { type: 'square', vol: 0.18 });
    this.tone(143, 0.55, { type: 'sawtooth', vol: 0.1 });
  },
  crash() {
    this.noise(1.2, { vol: 0.5, freq: 400, q: 0.6, type: 'lowpass', sweep: 0.3 });
    for (let i = 0; i < 6; i++) this.moku(0.6 + Math.random() * 0.5), this.tone(300 + Math.random() * 300, 0.08, { type: 'triangle', vol: 0.25, delay: 0.08 * i + Math.random() * 0.05 });
  },
  // 崩れた徳が地面に落ちる音（ごとっ）
  thud(vol = 0.3) {
    this.tone(130 + Math.random() * 60, 0.12, { type: 'triangle', vol, slide: 0.6 });
    this.noise(0.08, { vol: vol * 0.6, freq: 500, q: 0.8, type: 'lowpass' });
  },
  // ばつ印を押す音（どん）
  stamp() {
    this.tone(90, 0.25, { type: 'sine', vol: 0.5, slide: 0.5 });
    this.noise(0.15, { vol: 0.35, freq: 900, q: 0.7 });
    this.tone(220, 0.3, { type: 'square', vol: 0.08 });
  },
  whoosh() { this.noise(0.35, { vol: 0.12, freq: 600, q: 1.5, sweep: 4 }); },
};

// ===== 状態 =====
const S = {
  mode: 'title',       // title | play | collapse | result
  tower: [],           // 積んだ徳 {x}
  cur: null,           // 揺れている／落ちているブロック
  debris: [],          // 崩れたブロック
  particles: [],
  floats: [],          // 浮かぶ文字
  banner: null,
  phase: 0,            // 揺れの位相（ブロックをまたいで続く）
  camY: 0,
  t: 0,
  spawnTimer: 0,
  shake: 0,
  wobble: 0,           // 塔のぐらつき（0〜1）
  wobbleDir: 0,
  combo: 0,
  reason: '',
  resultTimer: 0,
  lastMilestone: 0,
  forceNext: null,
  stars: [],
  clouds: [],
};

let timeScale = 1;
let manual = false;
const events = [];
function emit(type, data = {}) { events.push({ type, t: S.t, ...data }); }

function makeSky() {
  const r = mulberry(12345);
  S.stars = Array.from({ length: 140 }, () => ({ x: r() * W, y: r() * H, s: r() * 1.6 + 0.3, tw: r() * 6 }));
  S.clouds = [];
  for (let i = 0; i < 26; i++) {
    S.clouds.push({ wy: (22 + r() * 13) * BH, x: r() * W, w: 60 + r() * 90, sp: 6 + r() * 12 });
  }
}
function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const topY = () => S.tower.length * BH;
const topX = () => (S.tower.length ? S.tower[S.tower.length - 1].x : W / 2);
// 次に積む字が何個目か
const nextNo = () => S.tower.length + 1;
// 61個目からは10個ごとに一段ずつ速くする
const swingLevel = (k = nextNo()) => k >= CONFIG.swingStepFrom ? Math.floor((k - CONFIG.swingStepFrom) / CONFIG.swingStepEvery) + 1 : 0;
const swingSpeed = (k = nextNo()) =>
  Math.min(CONFIG.swingMax, CONFIG.swingBase + CONFIG.swingPerBlock * (k - 1)) * (1 + CONFIG.swingStepRate * swingLevel(k));
function fakeRate(k) {
  let p = 0;
  for (const r of CONFIG.fakeRates) if (k >= r.from) p = r.p;
  return p;
}
const toScreenY = wy => CONFIG.groundScreenY - (wy - S.camY);

function resetGame() {
  S.tower = []; S.debris = []; S.particles = []; S.floats = [];
  S.banner = null; S.cur = null;
  S.phase = rand() * Math.PI * 2;
  S.camY = 0; S.spawnTimer = 0.35; S.shake = 0; S.wobble = 0;
  S.combo = 0; S.reason = ''; S.lastMilestone = 0; S.lastCount = 0; S.pendingCollapse = null;
  S.view = null; S.lastFake = false; S.fakeFx = null;
  S.mode = 'play';
  updateHud();
}

function chooseType() {
  const n = S.tower.length;
  if (S.forceNext) { const f = S.forceNext; S.forceNext = null; S.lastFake = f === 'fake'; return f; }
  // ニセモノの直後は必ず徳
  const kind = !S.lastFake && rand() < fakeRate(n + 1) ? 'fake' : 'toku';
  S.lastFake = kind === 'fake';
  return kind;
}

function spawn() {
  const kind = chooseType();
  const fakeCh = FAKES[Math.floor(rand() * FAKES.length)];
  const c = {
    x: W / 2 + CONFIG.swingAmp * Math.sin(S.phase),
    y: topY() + CONFIG.hoverGap,
    vy: 0, t: 0, a: 0, yaw: 0, alpha: 1, pop: 0,
    state: 'swing',
    kind,
    // 字は出てきたときのまま変わらない
    fake: kind === 'fake',
    ch: kind === 'fake' ? fakeCh : '徳',
    life: CONFIG.fakeLife,
  };
  S.cur = c;
  emit('spawn', { kind, ch: c.ch });
}

function puff(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, sp = 40 + rand() * 120;
    S.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + rand() * 0.4, t: 0, r: 3 + rand() * 4, color });
  }
}
function floatText(text, x, wy, color = '#fff', size = 22) {
  S.floats.push({ text, x, wy, t: 0, color, size });
}

function drop() {
  Sound.init();
  if (S.mode !== 'play' || !S.cur || S.cur.state !== 'swing') return false;
  S.cur.state = 'drop';
  S.cur.vy = 0;
  emit('drop', { ch: S.cur.ch, x: S.cur.x });
  return true;
}

// 重心チェック：各段より上の重心が、その段（または土台）の上に乗っているか
function stability(tower) {
  let maxRatio = 0, dir = 0, failLevel = -1;
  const n = tower.length;
  let sum = 0;
  for (let k = 0; k < n; k++) sum += tower[k].x;
  for (let i = -1; i < n - 1; i++) {
    if (i >= 0) sum -= tower[i].x;
    const cnt = n - 1 - i;
    const com = sum / cnt;
    const sx = i < 0 ? W / 2 : tower[i].x;
    const half = i < 0 ? CONFIG.platformW / 2 : BW / 2;
    const ratio = Math.abs(com - sx) / (half * CONFIG.stickiness);
    if (ratio > maxRatio) { maxRatio = ratio; dir = Math.sign(com - sx); }
    if (ratio > 1 && failLevel < 0) failLevel = i + 1;
  }
  return { maxRatio, dir, failLevel };
}

// 塔の傾き：各段で「上に乗る字の重心のずれ ÷ 限界」を求め、下から足し合わせた角度にする。
// 片側に寄るほど傾き、反対側で取り返すと戻る。
function leanTargets(tower) {
  const n = tower.length;
  const out = new Array(n).fill(0);
  let sum = 0, acc = 0;
  for (let k = 0; k < n; k++) sum += tower[k].x;
  for (let i = -1; i < n - 1; i++) {
    if (i >= 0) sum -= tower[i].x;
    const com = sum / (n - 1 - i);
    const sx = i < 0 ? W / 2 : tower[i].x;
    const half = i < 0 ? CONFIG.platformW / 2 : BW / 2;
    acc += (com - sx) / (half * CONFIG.stickiness) * CONFIG.leanPerLevel;
    out[i + 1] = Math.max(-CONFIG.leanMax, Math.min(CONFIG.leanMax, acc));
  }
  return out;
}
function updateLean() {
  const t = leanTargets(S.tower);
  S.tower.forEach((b, i) => { b.leanT = t[i]; if (b.lean === undefined) { b.lean = t[i]; b.lv = 0; } });
}

function land() {
  const c = S.cur;
  const tx = topX();
  const dx = c.x - tx;
  const supportHalf = S.tower.length ? BW / 2 : CONFIG.platformW / 2;
  // 踏み外し
  if (Math.abs(dx) > supportHalf + BW / 2 - CONFIG.minOverlap) {
    S.debris.push({ x: c.x, wy: c.y, vx: Math.sign(dx) * 60, vy: -100, a: 0, va: Math.sign(dx) * 3, yaw: c.yaw, vyaw: 6, ch: c.ch });
    S.cur = null;
    if (c.fake) {
      Sound.whoosh();
      floatText('…セーフ？', c.x, topY() + 40, '#ffe', 20);
      gameOver(`「${c.ch}」に手を出してしまった`, 'miss');
    } else {
      Sound.buzzer();
      gameOver('徳を踏み外した', 'miss');
    }
    return;
  }
  let perfect = false;
  if (S.tower.length && Math.abs(dx) <= CONFIG.perfect) { c.x = tx; perfect = true; }
  S.tower.push({ x: c.x, ch: c.ch, fake: c.fake });
  updateLean();
  S.cur = null;
  const wy = topY();

  if (c.fake) {
    Sound.buzzer();
    S.shake = 8;
    puff(c.x, wy - BH / 2, 24, '#ff5544');
    emit('fakeLanded', { ch: c.ch });
    // まず間違えた字を強調して見せ、それから全部崩れる
    S.fakeFx = { t: 0, idx: S.tower.length - 1, ch: c.ch, stamped: false };
    S.pendingCollapse = { level: 0, dir: Math.sign(dx) || 1, t: CONFIG.fakeShowTime };
    gameOver(`「${c.ch}」を積んでしまった…`, 'fake', true);
    return;
  }

  const st = stability(S.tower);
  if (st.failLevel >= 0) {
    Sound.crash();
    collapseFrom(st.failLevel, st.dir);
    gameOver('徳が傾いて崩れた', 'collapse');
    return;
  }
  S.wobble = st.maxRatio;
  S.wobbleDir = st.dir;

  if (perfect) {
    S.combo++;
    Sound.moku(1.15);
    Sound.rin(0.08 + Math.min(0.12, S.combo * 0.02));
    puff(c.x, wy, 14, '#ffd86b');
    floatText(S.combo > 1 ? `ぴったり ×${S.combo}` : 'ぴったり！', c.x, wy + 26, '#ffe27a', 22);
  } else {
    S.combo = 0;
    Sound.moku(0.95 + rand() * 0.1);
    puff(c.x, wy - BH, 6, 'rgba(255,255,255,.8)');
  }
  emit('land', { n: S.tower.length, perfect, dx });

  const ms = reachedMilestone(S.tower.length);
  if (ms.n > S.lastMilestone) {
    S.lastMilestone = ms.n;
    S.banner = { text: `${ms.name}超え！`, sub: `称号「${titleAt(S.tower.length)}」`, t: 0 };
    S.clearFx = { idx: MILESTONES.indexOf(ms), t: 0 };
    Sound.fanfare();
    emit('milestone', { name: ms.name, n: ms.n });
  }
  // 称号が上がったら知らせる（名所を越えた瞬間と重なったら、バナーの称号で兼ねる）
  if (TITLES.some(t => t.from > 0 && t.from === S.tower.length)) {
    const title = titleAt(S.tower.length);
    if (S.banner && S.banner.t === 0) S.banner.sub = `称号「${title}」に昇格`;
    else floatText(`称号「${title}」に昇格！`, W / 2, topY() + CONFIG.hoverGap * 0.55, '#ffe27a', 20);
    Sound.rin(0.12);
    emit('titleUp', { title, n: S.tower.length });
  }
  // 揺れが一段速くなったら知らせる
  const lv = swingLevel();
  if (lv > 0 && (nextNo() - CONFIG.swingStepFrom) % CONFIG.swingStepEvery === 0) {
    const msg = lv === 1 ? '揺れが速くなった！' : `揺れがさらに速く！ ×${lv}`;
    // 名所を越えた瞬間と重なったら、バナーの下に出す
    if (S.banner && S.banner.t === 0) S.banner.extra = msg;
    else floatText(msg, W / 2, topY() + CONFIG.hoverGap * 0.55, '#ffb3a8', 20);
    emit('speedUp', { level: lv });
  }
  S.spawnTimer = 0.22;
  updateHud();
}

function collapseFrom(level, dir) {
  if (level >= S.tower.length) return;
  const falling = S.tower.splice(level);
  const g = CONFIG.gravity * CONFIG.debrisGravity;
  falling.forEach((b, i) => {
    const h = i + 1;
    const wy = (level + i) * BH;
    // 高い段ほど遠くへ倒れる（倒れた木のように、高さに見合った距離まで散らばる）
    const reach = Math.min(CONFIG.spreadMax, Math.sqrt(wy * g / 2) * CONFIG.collapseSpread);
    S.debris.push({
      x: b.x, wy, ch: b.ch,
      vx: dir * (60 + Math.min(h, 20) * 6 + reach * (0.6 + rand() * 0.6)) + (rand() - 0.5) * (140 + 260 / h),
      vy: 40 + rand() * 160,
      a: b.lean || 0, va: dir * (1 + rand() * 2.5 + h * 0.05),
      yaw: 0, vyaw: (rand() - 0.5) * 5, red: b.fake,
    });
  });
  S.shake = 14;
}

// カメラを一気に引いて、塔の全体と崩れ落ちる様子を見せる
function startPullBack() {
  const towerH = (S.lastCount + 1) * BH;
  S.view = { t: 0, z: 1, zT: 1, cx: W / 2, camC: S.camY, towerH, topS0: toScreenY(towerH) };
}

function gameOver(reason, kind, delayCollapse = false) {
  S.mode = 'collapse';
  S.reason = reason;
  S.endKind = kind;
  S.resultTimer = delayCollapse ? CONFIG.fakeShowTime + 1.2 : 1.4;
  S.settleT = 0;
  S.view = null;
  if (!delayCollapse) { S.pendingCollapse = null; startPullBack(); }
  // 結果は最後の一手の前に積めていた「徳」の数で決める
  S.finalCount = S.lastCount;
  emit('gameover', { reason, kind });
}

function showResult() {
  S.mode = 'result';
  const n = S.finalCountFixed;
  const alt = altitudeAt(n);
  const ms = reachedMilestone(n);
  document.getElementById('reason').textContent = S.reason;
  const rank = document.getElementById('rank'), title = titleAt(n);
  rank.textContent = title;
  // 称号は1行に収める（長い称号は字を小さくする）
  rank.style.fontSize = `${Math.min(13, 80 / title.length).toFixed(2)}cqw`;
  document.getElementById('reach').textContent = ms.n > 0 ? `あなたの徳は${ms.name}を超えた` : 'あなたの徳はまだ地面にある';
  document.getElementById('rCount').textContent = n;
  document.getElementById('rAlt').textContent = formatAlt(alt);
  let best = 0;
  try { best = Number(localStorage.getItem('toku.best') || 0); } catch (e) { /* 保存できない環境 */ }
  if (n > best) { best = n; try { localStorage.setItem('toku.best', String(n)); } catch (e) { /* noop */ } }
  showBest(best);
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('result').classList.remove('hidden');
  emit('result', { n, title: titleAt(n) });
}

function showBest(best) {
  if (best === undefined) { try { best = Number(localStorage.getItem('toku.best') || 0); } catch (e) { best = 0; } }
  document.getElementById('best').textContent = best > 0 ? `最高記録：${best}徳（${formatAlt(altitudeAt(best))}・${titleAt(best)}）` : '';
}

const hudEls = {
  count: document.getElementById('count'),
  alt: document.getElementById('hudAlt'),
  next: document.getElementById('hudNext'),
};
function updateHud() {
  const n = S.tower.length;
  hudEls.count.textContent = n;
  hudEls.alt.textContent = formatAlt(altitudeAt(n));
  const nx = nextMilestone(n);
  hudEls.next.textContent = nx ? `次の目標：${nx.name}（${formatAlt(nx.m)}）あと${nx.n - n}徳` : '徳が宇宙を満たした';
}

// 崩れた字：落ちて、地面（または先に落ちた字の上）で跳ねて止まる
function pilePeak(x) {
  let best = null;
  for (const o of S.debris) if (o.settled && o.top < BH * 1.6 && Math.abs(o.x - x) < BW * 0.7 && (!best || o.top > best.top)) best = o;
  return best;
}
function updateDebris(dt) {
  const g = CONFIG.gravity * CONFIG.debrisGravity;
  const Q = Math.PI / 2;
  for (const d of S.debris) {
    if (d.settled) {
      d.a += (d.ra - d.a) * Math.min(1, dt * 10);
      d.yaw += (d.ryaw - d.yaw) * Math.min(1, dt * 8);
      continue;
    }
    d.air = (d.air || 0) + dt;
    d.vy -= g * dt;
    d.wy += d.vy * dt;
    d.x += d.vx * dt;
    d.a += d.va * dt;
    d.yaw += (d.vyaw || 0) * dt;
    if (d.vy >= 0) continue;
    const hh = BH / 2 * Math.abs(Math.cos(d.a)) + BW / 2 * Math.abs(Math.sin(d.a));
    // 落ちはじめは地面にだけ当たる（真下に残った字の上で積み直さない）
    const peak = d.air > 0.45 ? pilePeak(d.x) : null;
    const floor = peak ? peak.top : 0;
    if (d.wy + BH / 2 - hh > floor) continue;
    const speed = -d.vy;
    if (speed > 260 && (d.bounces || 0) < 2) {
      d.wy = floor + hh - BH / 2;
      d.vy = speed * 0.28;
      d.vx *= 0.55;
      d.va = d.va * 0.5 + (rand() - 0.5) * 3;
      d.bounces = (d.bounces || 0) + 1;
    } else {
      // 寝かせるか立てるか、近いほうの向きで止める
      // 下の字の上に乗ったら、少し横にずらして山にする
      if (peak) d.x += (d.x >= peak.x ? 1 : -1) * BW * (0.25 + rand() * 0.2);
      const k = Math.round(d.a / Q);
      const rh = (k % 2 ? BW : BH) / 2;
      d.settled = true;
      d.ra = k * Q;
      d.ryaw = Math.round(d.yaw / Math.PI) * Math.PI;
      d.wy = floor + rh - BH / 2;
      d.top = floor + rh * 2;
      d.vx = d.vy = d.va = 0;
      puff(d.x, floor, 5, 'rgba(210,190,150,.8)');
    }
    if (S.t - (S.lastThud || 0) > 0.05) {
      S.lastThud = S.t;
      Sound.thud(Math.min(0.35, 0.08 + speed / 3000));
    }
  }
}

// 引いたカメラ：塔の頂上を画面の上の方、地面を画面の下の方に収め、散らばった字も入れる
function updateView(dt) {
  const v = S.view;
  v.t += dt;
  const zH = Math.min(1, (CONFIG.pullGroundY - CONFIG.pullTopY) / v.towerH);
  // 散らばった範囲（と残った塔）の真ん中を画面の中央に
  let x0 = W / 2 - BW, x1 = W / 2 + BW;
  for (const d of S.debris) { x0 = Math.min(x0, d.x - BW * 0.7); x1 = Math.max(x1, d.x + BW * 0.7); }
  const zW = Math.min(1, (W - 16) / (x1 - x0));
  v.cx += ((x0 + x1) / 2 - v.cx) * Math.min(1, dt * 5);
  if (S.settleT > 0.25) {
    // 散らばり終えたら、残った塔と地面の徳の山に寄る
    const left = Math.max(BH * 2.5, (S.tower.length + 1) * BH);
    v.zT = Math.max(0.015, Math.min(1, zW, (CONFIG.pullGroundY - CONFIG.pullTopY) / left));
    v.fitH = left;
  } else {
    v.zT = Math.max(0.015, Math.min(v.zT, zH, zW));
  }
  v.z = Math.exp(Math.log(v.z) + (Math.log(v.zT) - Math.log(v.z)) * Math.min(1, dt * 6));
}
function viewTransform() {
  const v = S.view;
  if (!v) return { z: 1, tx: 0, ty: 0, l: 0, r: W, t: 0, b: H };
  const p = easeInOut(Math.min(1, v.t / CONFIG.pullBackTime));
  const topS = v.topS0 + (CONFIG.pullTopY - v.topS0) * p;
  const groundS = Math.max(topS + (v.fitH || v.towerH) * v.z, CONFIG.groundScreenY + (CONFIG.pullGroundY - CONFIG.groundScreenY) * p);
  const z = v.z;
  const tx = W / 2 - v.cx * z;
  const ty = groundS - (CONFIG.groundScreenY + v.camC) * z;
  return { z, tx, ty, l: -tx / z, r: (W - tx) / z, t: -ty / z, b: (H - ty) / z };
}
function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

// ===== 更新 =====
function update(dt) {
  S.t += dt;
  if (S.mode === 'play' || S.mode === 'collapse') S.phase += swingSpeed() * dt;

  if (S.mode === 'play') {
    S.lastCount = S.tower.length;
    if (!S.cur) {
      S.spawnTimer -= dt;
      if (S.spawnTimer <= 0) spawn();
    }
    const c = S.cur;
    if (c) {
      c.t += dt;
      c.pop = Math.min(1, c.pop + dt * 6);
      if (c.state === 'swing') {
        c.x = W / 2 + CONFIG.swingAmp * Math.sin(S.phase);
        c.y = topY() + CONFIG.hoverGap;
        c.yaw = 0.45 * Math.sin(S.t * 1.7);
        if (c.fake && c.t >= c.life) {
          c.state = 'leave';
          Sound.whoosh();
          floatText('見送った！', c.x, c.y + BH + 10, '#bff7c4', 20);
          emit('passed', { ch: c.ch });
        }
      } else if (c.state === 'drop') {
        c.vy += CONFIG.gravity * dt;
        c.y -= c.vy * dt;
        c.yaw *= Math.max(0, 1 - dt * 12);
        if (c.y <= topY()) { c.y = topY(); land(); }
      } else if (c.state === 'leave') {
        c.y += 420 * dt;
        c.alpha -= dt * 2.5;
        c.a += dt * 1.5;
        c.yaw += dt * 14;
        if (c.alpha <= 0) { S.cur = null; S.spawnTimer = 0.25; }
      }
    }
  }

  if (S.mode === 'collapse') {
    if (S.pendingCollapse) {
      S.pendingCollapse.t -= dt;
      if (S.fakeFx) {
        S.fakeFx.t += dt;
        // ばつ印を押す瞬間
        if (!S.fakeFx.stamped && S.fakeFx.t >= 0.35) {
          S.fakeFx.stamped = true;
          S.shake = 12;
          Sound.stamp();
        }
      }
      if (S.pendingCollapse.t <= 0) {
        Sound.crash();
        collapseFrom(S.pendingCollapse.level, S.pendingCollapse.dir);
        S.pendingCollapse = null;
        S.fakeFx = null;
        startPullBack();
      }
    }
    S.resultTimer -= dt;
    const settled = !S.pendingCollapse && S.debris.every(d => d.settled);
    S.settleT = settled ? S.settleT + dt : 0;
    if ((S.resultTimer <= 0 && S.settleT >= CONFIG.resultAfterSettle) || (S.view && S.view.t >= CONFIG.resultMax)) {
      S.finalCountFixed = S.finalCount;
      showResult();
    }
  }

  // カメラ
  const target = Math.max(0, topY() - (CONFIG.groundScreenY - CONFIG.towerTopScreenY));
  if (S.mode === 'play') S.camY += (target - S.camY) * Math.min(1, dt * 5);

  // 傾きはばねで追いかける（置いた瞬間に少し揺れてから落ち着く）
  for (const b of S.tower) {
    if (b.leanT === undefined) continue;
    b.lv += ((b.leanT - b.lean) * 140 - b.lv * 11) * dt;
    b.lean += b.lv * dt;
  }
  updateDebris(dt);
  if (S.view) updateView(dt);
  for (const p of S.particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; }
  S.particles = S.particles.filter(p => p.t < p.life);
  for (const f of S.floats) f.t += dt;
  S.floats = S.floats.filter(f => f.t < 1.1);
  if (S.banner) { S.banner.t += dt; if (S.banner.t > 2.2) S.banner = null; }
  if (S.clearFx) { S.clearFx.t += dt; if (S.clearFx.t > 1.5) S.clearFx = null; }
  S.lmFade = (S.lmFade || 0) + dt;
  S.shake = Math.max(0, S.shake - dt * 30);
  for (const cl of S.clouds) { cl.x += cl.sp * dt; if (cl.x - cl.w > W) cl.x = -cl.w; }
}

// ===== 空の色 =====
const SKY = [
  [0, [159, 214, 255]],
  [2.0, [130, 200, 255]],
  [3.0, [100, 175, 240]],
  [4.0, [55, 115, 205]],
  [4.7, [20, 40, 105]],
  [5.5, [5, 9, 30]],
  [8, [2, 2, 10]],
  [12, [6, 2, 18]],
  [20, [12, 4, 30]],
  [27, [0, 0, 0]],
];
function skyAt(lt) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [a, ca] = SKY[i], [b, cb] = SKY[i + 1];
    if (lt <= b) {
      const t = Math.max(0, (lt - a) / (b - a));
      return ca.map((v, k) => Math.round(v + (cb[k] - v) * t));
    }
  }
  return SKY[SKY.length - 1][1];
}
const logAltAtWorldY = wy => Math.log10(Math.max(1, altitudeAt(Math.max(0, wy / BH))));

// ===== 描画 =====
function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = S.shake ? (Math.random() - 0.5) * S.shake : 0;
  const sy = S.shake ? (Math.random() - 0.5) * S.shake : 0;

  // 空
  const V = S.vb = viewTransform();
  let wyTop = S.camY + CONFIG.groundScreenY - V.t;
  let wyBot = S.camY + CONFIG.groundScreenY - V.b;
  if (S.view) { wyTop = Math.min(wyTop, S.view.towerH * 1.1); wyBot = Math.max(0, Math.min(wyBot, wyTop)); }
  const cTop = skyAt(logAltAtWorldY(wyTop));
  const cBot = skyAt(logAltAtWorldY(wyBot));
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgb(${cTop})`);
  g.addColorStop(1, `rgb(${cBot})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 星
  const lt = logAltAtWorldY(S.camY + 300);
  const starA = Math.max(0, Math.min(1, (lt - 4.3) / 0.9));
  if (starA > 0) {
    for (const s of S.stars) {
      const yy = (s.y + S.camY * 0.05) % H;
      ctx.globalAlpha = starA * (0.6 + 0.4 * Math.sin(S.t * 2 + s.tw));
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x, yy, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(sx, sy);
  ctx.translate(V.tx, V.ty);
  ctx.scale(V.z, V.z);

  // 雲（世界座標。引いたときは左右にも並べる）
  ctx.fillStyle = `rgba(255,255,255,${0.75 * Math.min(1, V.z * 2.2)})`;
  for (const cl of S.clouds) {
    const y = toScreenY(cl.wy);
    if (y < V.t - 60 || y > V.b + 60) continue;
    for (let k = Math.floor(V.l / W) - 1; k <= Math.ceil(V.r / W); k++) cloud(cl.x + k * W, y, cl.w);
  }

  // 名所（直前にクリアしたものと次の目標）
  drawLandmarks();

  // 地面と街
  drawGround();

  // 塔・揺れる字・崩れた字
  const items = [];
  const n = S.tower.length;
  const wob = S.mode === 'play' && S.wobble > CONFIG.wobbleWarn
    ? Math.sin(S.t * 9) * (S.wobble - CONFIG.wobbleWarn) * 10 : 0;
  for (let i = 0; i < n; i++) {
    const b = S.tower[i];
    const h = n > 1 ? i / (n - 1) : 0;
    let tx = b.x + wob * h;
    if (S.fakeFx) {
      if (i === S.fakeFx.idx) continue;   // 間違えた字は暗幕の上に描く（drawFakeFx）
      tx += fakeTremble() * (i + 1) / n;
    }
    items.push({ x: tx, y: toScreenY(i * BH) - BH, ch: b.ch, angle: (b.lean || 0) + wob * h * 0.004, red: b.fake });
  }

  const c = S.cur;
  if (c) {
    const yS = toScreenY(c.y) - BH;
    if (c.state === 'swing') {
      // つり糸
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(c.x, -10); ctx.lineTo(c.x, yS + 6); ctx.stroke();
      // 落下位置のガイド
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(c.x - BW / 2, yS + BH, BW, toScreenY(topY()) - yS - BH);
    }
    const s = (0.6 + 0.4 * easeOutBack(c.pop)) * (c.state === 'leave' ? Math.max(0.01, c.alpha) : 1);
    items.push({ x: c.x, y: yS, ch: c.ch, angle: c.a, yaw: c.yaw, scale: s });
  }
  for (const d of S.debris) items.push({ x: d.x, y: toScreenY(d.wy) - BH, ch: d.ch, angle: d.a, yaw: d.yaw, red: d.red });

  for (const it of items) drawBlock(it.x, it.y, it.ch, it.angle || 0, it.scale ?? 1, it.red, it.yaw || 0);

  for (const p of S.particles) {
    ctx.globalAlpha = 1 - p.t / p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, toScreenY(p.y), p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // 浮かぶ文字
  for (const f of S.floats) {
    const y = toScreenY(f.wy) * V.z + V.ty - f.t * 40;
    ctx.globalAlpha = Math.min(1, 2 - f.t * 1.8);
    textOutlined(f.text, f.x * V.z + V.tx, y, `700 ${f.size}px ${UI_FONT}`, f.color);
  }
  ctx.globalAlpha = 1;

  if (S.mode === 'play' && S.wobble > CONFIG.wobbleWarn && !S.cur?.fake) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(S.t * 10);
    textOutlined('グラグラ…', W / 2, H - 28, `700 20px ${UI_FONT}`, '#ffb3a8');
    ctx.globalAlpha = 1;
  }

  // 名所バナー
  if (S.banner) {
    const b = S.banner;
    const a = b.t < 0.2 ? b.t / 0.2 : b.t > 1.8 ? (2.2 - b.t) / 0.4 : 1;
    const sc = 0.8 + 0.2 * easeOutBack(Math.min(1, b.t / 0.3));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, 250);
    ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(80, 10, 10, .72)';
    roundRect(-150, -42, 300, 84, 14); ctx.fill();
    // 長い名前は文字を小さくして枠に収める
    ctx.font = `34px ${KANJI_FONT}`;
    const fs = Math.min(34, 34 * 276 / ctx.measureText(b.text).width);
    textOutlined(b.text, 0, -8, `${fs.toFixed(1)}px ${KANJI_FONT}`, '#ffe27a');
    textOutlined(b.sub, 0, 26, `700 16px ${UI_FONT}`, '#fff');
    if (b.extra) {
      ctx.fillStyle = 'rgba(90, 20, 20, .8)';
      roundRect(-110, 50, 220, 28, 14); ctx.fill();
      textOutlined(b.extra, 0, 64, `700 15px ${UI_FONT}`, '#ffb3a8');
    }
    ctx.restore();
  }

  if (S.mode === 'collapse') {
    if (S.fakeFx) drawFakeFx();
    else {
      ctx.fillStyle = `rgba(120, 0, 0, ${Math.min(0.16, (S.view ? S.view.t : 0) * 0.2)})`;
      ctx.fillRect(0, 0, W, H);
      textOutlined(S.reason, W / 2, 104, `700 20px ${UI_FONT}`, '#fff');
    }
  }
}

// 崩れる直前に塔が震える
function fakeTremble() {
  const t = S.fakeFx.t, start = CONFIG.fakeShowTime - 0.6;
  if (t < start) return 0;
  return Math.sin(t * 70) * Math.min(1, (t - start) / 0.6) * 5;
}

// 得・特を積んでしまったときの強調：周りを暗くし、字を脈打たせ、ばつ印と「得 ≠ 徳」を出す
function drawFakeFx() {
  const f = S.fakeFx;
  const b = S.tower[f.idx];
  if (!b) return;
  const n = S.tower.length;
  const x = b.x + fakeTremble() * (f.idx + 1) / n;
  const top = toScreenY(f.idx * BH) - BH, cy = top + BH / 2;
  const fadeIn = Math.min(1, f.t / 0.25);
  // スポットライト
  const g = ctx.createRadialGradient(x, cy, 55, x, cy, 150);
  g.addColorStop(0, 'rgba(20,0,0,0)');
  g.addColorStop(1, `rgba(20,0,0,${0.62 * fadeIn})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // 赤い光の輪
  const pulse = 0.5 + 0.5 * Math.sin(f.t * 12);
  ctx.save();
  ctx.globalAlpha = fadeIn * (0.45 + 0.35 * pulse);
  ctx.fillStyle = rad(ctx, x, cy, 20, 95, ['rgba(255,60,40,.9)', 'rgba(255,60,40,0)']);
  ctx.beginPath(); ctx.arc(x, cy, 95, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // 間違えた字（脈打つ）
  const sc = 1 + 0.22 * easeOutBack(Math.min(1, f.t / 0.3)) * (0.8 + 0.2 * pulse);
  drawBlock(x, top, b.ch, b.lean || 0, sc, true);
  // ばつ印（ハンコのように押す）
  if (f.t >= 0.35) {
    const k = Math.min(1, (f.t - 0.35) / 0.12);
    const s = 2.2 - 1.2 * k;
    ctx.save();
    ctx.translate(x, cy);
    ctx.scale(s, s);
    // 字が読めるよう、細めで半透明にする
    ctx.globalAlpha = 0.6 * k;
    ctx.lineCap = 'round';
    for (const [w, col] of [[9, 'rgba(255,255,255,.9)'], [5, '#e0201a']]) {
      ctx.lineWidth = w; ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo(-50, -46); ctx.lineTo(50, 46);
      ctx.moveTo(50, -46); ctx.lineTo(-50, 46);
      ctx.stroke();
    }
    ctx.restore();
  }
  // 「得」≠「徳」のカード
  const ct = Math.min(1, Math.max(0, (f.t - 0.15) / 0.3));
  if (ct > 0) {
    const cardY = Math.max(96, top - 120);
    ctx.save();
    ctx.globalAlpha = ct;
    ctx.translate(W / 2, cardY);
    const cs = 0.7 + 0.3 * easeOutBack(ct);
    ctx.scale(cs, cs);
    ctx.fillStyle = 'rgba(70, 6, 6, .88)';
    roundRect(-140, -50, 280, 100, 16); ctx.fill();
    ctx.strokeStyle = '#ff6b5e'; ctx.lineWidth = 2;
    roundRect(-140, -50, 280, 100, 16); ctx.stroke();
    textOutlined(`「${f.ch}」は徳じゃない！`, 0, -26, `700 17px ${UI_FONT}`, '#fff');
    textOutlined(f.ch, -52, 14, `46px ${GLYPH_FONT}`, '#ff6b5e');
    textOutlined('≠', 0, 14, `700 34px ${UI_FONT}`, '#fff');
    textOutlined('徳', 52, 14, `46px ${GLYPH_FONT}`, '#ffd84f');
    ctx.restore();
  }
}

function easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function textOutlined(text, x, y, font, color) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0,0,0,.6)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// ===== 立体文字 =====
// 字の正面・側面・縁を画像として作っておき、側面を奥へずらして重ねて厚みを出す。
// 字は当たり判定の箱（BW×BH）にぴったり収まるよう伸縮する。ニセモノも見た目は同じ。
const GLYPH_FONT = '"Dela Gothic One", "Hiragino Sans", "Yu Gothic", sans-serif';
const GLYPH_DEPTH = 9;      // 奥行き（px）
const GLYPH_LAYERS = 10;
const GLYPH_PAD = 8;
const GLYPH_RES = 3;        // 画像の解像度倍率
const glyphCache = new Map();
const GLYPH_COLORS = {
  gold: { face: ['#fff7c9', '#ffd84f', '#e9a020', '#b56810'], stroke: '#6e3b06', side: '#7f4a0c', edge: '#c07a1a' },
  red: { face: ['#ffd9d0', '#ff6a50', '#d0261a', '#7d0d08'], stroke: '#4a0704', side: '#5e0d08', edge: '#a3241a' },
};

function glyphSprites(ch, tint) {
  const key = ch + tint;
  if (glyphCache.has(key)) return glyphCache.get(key);
  const col = GLYPH_COLORS[tint];
  const mc = document.createElement('canvas').getContext('2d');
  mc.font = `100px ${GLYPH_FONT}`;
  const m = mc.measureText(ch);
  const left = m.actualBoundingBoxLeft || 0, right = m.actualBoundingBoxRight || 100;
  const asc = m.actualBoundingBoxAscent || 88, desc = m.actualBoundingBoxDescent || 12;
  const gw = left + right, gh = asc + desc;
  const sx = BW / gw, sy = BH / gh;
  const cw = BW + GLYPH_PAD * 2, chh = BH + GLYPH_PAD * 2;
  const make = (fill, stroke, shine) => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(cw * GLYPH_RES); c.height = Math.ceil(chh * GLYPH_RES);
    const x = c.getContext('2d');
    x.scale(GLYPH_RES, GLYPH_RES);
    x.translate(cw / 2, chh / 2);
    x.scale(sx, sy);
    x.font = `100px ${GLYPH_FONT}`;
    x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    const tx = (left - right) / 2, ty = (asc - desc) / 2;
    if (Array.isArray(fill)) {
      const g = x.createLinearGradient(0, -gh / 2, 0, gh / 2);
      fill.forEach((c2, i) => g.addColorStop(i / (fill.length - 1), c2));
      x.fillStyle = g;
    } else x.fillStyle = fill;
    x.fillText(ch, tx, ty);
    if (shine) {
      // 上半分に光沢
      x.globalCompositeOperation = 'source-atop';
      const g = x.createLinearGradient(0, -gh / 2, 0, 0);
      g.addColorStop(0, 'rgba(255,255,255,.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(-gw, -gh / 2, gw * 2, gh / 2);
      x.globalCompositeOperation = 'source-over';
    }
    if (stroke) {
      x.lineJoin = 'round';
      x.lineWidth = 2.2 / Math.min(sx, sy);
      x.strokeStyle = stroke;
      x.strokeText(ch, tx, ty);
    }
    return c;
  };
  const sp = {
    face: make(col.face, col.stroke, true),
    side: make(col.side, null, false),
    edge: make(col.edge, null, false),
  };
  glyphCache.set(key, sp);
  return sp;
}

// x は中心、y は上端の画面座標。angle は画面内の回転、yaw は縦軸まわりの回転。
function drawBlock(x, y, ch, angle, scale, red, yaw = 0) {
  const sp = glyphSprites(ch, red ? 'red' : 'gold');
  const cw = BW + GLYPH_PAD * 2, chh = BH + GLYPH_PAD * 2;
  const cy = Math.cos(yaw);
  const offX = GLYPH_DEPTH * Math.sin(yaw + 0.6);
  const offY = -GLYPH_DEPTH * 0.7;
  ctx.save();
  ctx.translate(x, y + BH / 2);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  for (let k = GLYPH_LAYERS; k >= 1; k--) {
    const f = k / GLYPH_LAYERS;
    ctx.save();
    ctx.translate(offX * f, offY * f);
    ctx.scale(cy, 1);
    ctx.drawImage(k === 1 ? sp.edge : sp.side, -cw / 2, -chh / 2, cw, chh);
    ctx.restore();
  }
  ctx.scale(cy, 1);
  ctx.drawImage(sp.face, -cw / 2, -chh / 2, cw, chh);
  ctx.restore();
}

function cloud(x, y, w) {
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.5, w * 0.16, 0, 0, Math.PI * 2);
  ctx.ellipse(x - w * 0.18, y - w * 0.1, w * 0.22, w * 0.15, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.12, y - w * 0.13, w * 0.26, w * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGround() {
  const V = S.vb || { l: 0, r: W, t: 0, b: H };
  const gy = toScreenY(0);
  if (gy > V.b + 10) return;
  // 遠くの街（引いたときは左右にも続く）
  ctx.fillStyle = '#b9d3e8';
  let r = mulberry(7);
  for (let x = -10; x < V.r; x += 18 + r() * 14) {
    const bh = 20 + r() * 60;
    ctx.fillRect(x, gy - bh, 16 + r() * 10, bh);
  }
  r = mulberry(9);
  for (let x = -10; x > V.l - 30;) {
    const bw = 16 + r() * 10, bh = 20 + r() * 60;
    x -= bw + 2 + r() * 14;
    ctx.fillRect(x, gy - bh, bw, bh);
  }
  ctx.fillStyle = '#6aa84f';
  ctx.fillRect(V.l, gy, V.r - V.l, V.b - gy + 20);
  ctx.fillStyle = '#5a9441';
  ctx.fillRect(V.l, gy, V.r - V.l, 6);
  // 土台（石段）
  const pw = CONFIG.platformW;
  ctx.fillStyle = '#9b9b9b';
  ctx.fillRect(W / 2 - pw / 2, gy - 4, pw, 22);
  ctx.fillStyle = '#7d7d7d';
  ctx.fillRect(W / 2 - pw / 2, gy + 14, pw, 4);
  ctx.fillStyle = '#4b4b4b';
  ctx.font = `700 11px ${UI_FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('徳 積 み 場', W / 2, gy + 7);
}

function label(text, x, y, align = 'center') {
  ctx.save();
  ctx.globalAlpha *= Math.max(0, Math.min(1, (y - 110) / 40)); // 上部の表示と重ならないよう薄くする
  ctx.font = `700 12px ${UI_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,.5)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ===== 名所 =====
// 名所の絵は一度だけ画像に描いて使い回す（sprite）。画面には「直前にクリアした名所」と「次の目標」だけを出す。
// 次の目標は、遠いうちは空の上の方に霞んで見え、近づくほどはっきりする。頂上は届く高さ（n 個目の上端）にそろう。
const LM_PIN_Y = 96;                 // 遠い目標を見せておく画面上の高さ
const lmCache = new Map();

function lin(x, x0, y0, x1, y1, stops) {
  const g = x.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(Array.isArray(c) ? c[0] : i / (stops.length - 1), Array.isArray(c) ? c[1] : c));
  return g;
}
function rad(x, cx, cy, r0, r1, stops, ox = 0, oy = 0) {
  const g = x.createRadialGradient(cx + ox, cy + oy, r0, cx, cy, r1);
  stops.forEach((c, i) => g.addColorStop(Array.isArray(c) ? c[0] : i / (stops.length - 1), Array.isArray(c) ? c[1] : c));
  return g;
}

function sprite(key) {
  if (lmCache.has(key)) return lmCache.get(key);
  const def = LANDMARKS[key];
  let w = def.w, h = def.h;
  if (def.grounded) {
    h = MILESTONES.find(m => m.draw === key).n * BH;
    if (key === 'house' || key === 'buddha') w = def.w * h / def.h;   // 比率を保って拡大する絵
  }
  const res = Math.min(3, Math.max(1.5, Math.ceil(dpr)) * (h > 900 ? 0.75 : 1));
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * res); c.height = Math.ceil(h * res);
  const x = c.getContext('2d');
  x.scale(res, res);
  def.build(x, w, h, mulberry(key.length * 977 + 13));
  const sp = { c, w, h };
  lmCache.set(key, sp);
  return sp;
}

// 星の玉：paint で模様を描き、左上から光が当たったような陰と、ふちの光をつける
function planetBall(x, cx, cy, R, glow, paint) {
  if (glow) {
    x.fillStyle = rad(x, cx, cy, R * 0.92, R * 1.22, [glow, 'rgba(0,0,0,0)']);
    x.beginPath(); x.arc(cx, cy, R * 1.22, 0, Math.PI * 2); x.fill();
  }
  x.save();
  x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.clip();
  paint();
  x.fillStyle = rad(x, cx, cy, 0, R * 1.08, [[0, 'rgba(255,255,255,.14)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,16,.78)']], -R * 0.42, -R * 0.42);
  x.fillRect(cx - R, cy - R, R * 2, R * 2);
  x.restore();
}

// --- 各名所の絵（x は描画先、w/h は大きさ、r は固定の乱数） ---
const LANDMARKS = {
  house: {
    w: 104, h: 100, cx: 92, grounded: true,
    build(x, w, h) {
      x.scale(w / 104, h / 100); w = 104; h = 100;   // 元の絵（104×100）を比率を保って拡大
      // 1階・2階の壁
      x.fillStyle = lin(x, 0, 0, w, 0, ['#f6f0e4', '#ddd2bf']);
      x.fillRect(14, 36, 76, h - 36);
      // 屋根（瓦）
      x.save();
      x.beginPath(); x.moveTo(0, 42); x.lineTo(52, 6); x.lineTo(104, 42); x.lineTo(96, 44); x.lineTo(8, 44); x.closePath();
      x.fillStyle = lin(x, 0, 6, 0, 44, ['#5a6672', '#2c343c']); x.fill();
      x.clip();
      x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 1;
      for (let y = 10; y < 44; y += 5) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
      x.restore();
      // 1階と2階の間の庇
      x.fillStyle = '#3a434c'; x.fillRect(10, 64, 84, 5);
      x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(14, 69, 76, 4);
      // 窓
      const win = (wx, wy, ww, wh) => {
        x.fillStyle = '#fff'; x.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
        x.fillStyle = lin(x, 0, wy, 0, wy + wh, ['#cfe6f7', '#7ea9cc']); x.fillRect(wx, wy, ww, wh);
        x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(wx + 2, wy + 2, ww * 0.25, wh - 4);
        x.fillStyle = '#9aa7b2'; x.fillRect(wx + ww / 2 - 0.5, wy, 1, wh);
      };
      win(24, 46, 22, 14); win(58, 46, 22, 14);
      // ベランダの手すり
      x.strokeStyle = '#8b939b'; x.lineWidth = 1.2;
      x.strokeRect(54, 56, 30, 7);
      for (let i = 57; i < 84; i += 4) { x.beginPath(); x.moveTo(i, 56); x.lineTo(i, 63); x.stroke(); }
      win(24, 76, 24, 16);
      // 玄関
      x.fillStyle = lin(x, 60, 0, 80, 0, ['#7a5434', '#5a3a22']); x.fillRect(60, 76, 18, h - 76);
      x.fillStyle = '#e7c06a'; x.fillRect(74, 88, 2, 2);
      // 影
      x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(76, 36, 14, h - 36);
    },
  },

  buddha: {
    w: 160, h: 140, cx: 300, grounded: true,
    build(x, w, h) {
      x.scale(w / 160, h / 140); w = 160; h = 140;  // 元の絵（160×140）を比率を保って拡大
      const cx = w / 2;
      // 光背（金色の舟形）
      x.beginPath();
      x.moveTo(cx, 0);
      x.bezierCurveTo(cx + 70, 30, cx + 72, 90, cx + 60, 118);
      x.lineTo(cx - 60, 118);
      x.bezierCurveTo(cx - 72, 90, cx - 70, 30, cx, 0);
      x.fillStyle = rad(x, cx, 60, 10, 80, ['#ffe9a3', '#e0ad3c', '#9c6c18']); x.fill();
      x.strokeStyle = 'rgba(255,240,190,.6)'; x.lineWidth = 2; x.stroke();
      for (let i = 0; i < 9; i++) { // 化仏の小さな円
        const a = Math.PI * (0.15 + i * 0.0875) + Math.PI;
        x.fillStyle = 'rgba(255,236,170,.8)';
        x.beginPath(); x.arc(cx + Math.cos(a) * 52, 64 + Math.sin(a) * 52, 3, 0, Math.PI * 2); x.fill();
      }
      const bronze = lin(x, cx - 50, 0, cx + 50, 0, ['#8a7848', '#5a4a2a', '#3a2f1a']);
      // 蓮の台座
      for (let k = 0; k < 2; k++) {
        const y = h - 22 + k * 10;
        x.fillStyle = k ? '#4a3c22' : '#6a5832';
        x.beginPath(); x.ellipse(cx, y, 64 - k * 6, 9, 0, 0, Math.PI * 2); x.fill();
      }
      for (let i = -4; i <= 4; i++) {
        x.fillStyle = 'rgba(160,135,80,.55)';
        x.beginPath(); x.ellipse(cx + i * 14, h - 24, 7, 10, 0, 0, Math.PI * 2); x.fill();
      }
      // 座った体（膝・胴）
      x.fillStyle = bronze;
      x.beginPath();
      x.moveTo(cx - 58, h - 26);
      x.quadraticCurveTo(cx - 60, h - 46, cx - 34, h - 50);
      x.quadraticCurveTo(cx - 30, 64, cx - 14, 56);
      x.lineTo(cx + 14, 56);
      x.quadraticCurveTo(cx + 30, 64, cx + 34, h - 50);
      x.quadraticCurveTo(cx + 60, h - 46, cx + 58, h - 26);
      x.closePath(); x.fill();
      // 衣のひだ
      x.strokeStyle = 'rgba(255,230,170,.18)'; x.lineWidth = 1.2;
      for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(cx - 30 + i * 4, 66 + i * 6); x.quadraticCurveTo(cx, 80 + i * 6, cx + 30 - i * 2, 64 + i * 7); x.stroke(); }
      // 手（法界定印）
      x.fillStyle = '#6b5a34';
      x.beginPath(); x.ellipse(cx, h - 44, 16, 6, 0, 0, Math.PI * 2); x.fill();
      // 首・頭
      x.fillStyle = bronze;
      x.fillRect(cx - 6, 48, 12, 10);
      x.beginPath(); x.ellipse(cx, 38, 15, 17, 0, 0, Math.PI * 2); x.fill();
      // 耳
      x.beginPath(); x.ellipse(cx - 15, 42, 3, 9, 0, 0, Math.PI * 2); x.ellipse(cx + 15, 42, 3, 9, 0, 0, Math.PI * 2); x.fill();
      // 螺髪（頭の粒）と肉髻
      x.fillStyle = '#3a2f1a';
      x.beginPath(); x.ellipse(cx, 26, 15, 9, 0, Math.PI, 0); x.fill();
      x.beginPath(); x.arc(cx, 20, 8, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(255,230,170,.18)';
      for (let i = 0; i < 18; i++) { x.beginPath(); x.arc(cx - 12 + (i % 6) * 5, 18 + Math.floor(i / 6) * 4, 1.2, 0, Math.PI * 2); x.fill(); }
      // 光の当たる側
      x.fillStyle = 'rgba(255,240,200,.12)';
      x.beginPath(); x.ellipse(cx - 6, 34, 6, 10, 0, 0, Math.PI * 2); x.fill();
    },
  },

  pagoda: {
    w: 210, h: 250, cx: 80, grounded: true,
    build(x, w, h) {
      const cx = w / 2;
      const base = 16, sorin = h * 0.24;            // 相輪は全体の約1/4
      const story = (h - sorin - base) / 5;
      // 相輪（九輪・水煙）
      x.fillStyle = lin(x, cx - 4, 0, cx + 4, 0, ['#f6dc84', '#b8902e']);
      x.fillRect(cx - 2.2, 8, 4.4, sorin);
      for (let i = 0; i < 9; i++) {
        const y = sorin * 0.3 + i * sorin * 0.06;
        x.beginPath(); x.ellipse(cx, y, 8 - i * 0.25, 2, 0, 0, Math.PI * 2); x.fill();
      }
      x.beginPath(); x.ellipse(cx, sorin * 0.17, 6, 10, 0, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.arc(cx, 6, 4.5, 0, Math.PI * 2); x.fill();
      x.fillRect(cx - 10, sorin - 10, 20, 10);       // 露盤
      for (let k = 0; k < 5; k++) {
        const ry = sorin + k * story;
        const rw = w * (0.3 + k * 0.04);            // 屋根の半幅（下ほど広い）
        const bw = w * (0.11 + k * 0.018);          // 軸部の半幅
        const rt = Math.min(18, story * 0.2);       // 屋根の厚み
        // 軸部（朱塗りの柱と白壁）
        x.fillStyle = lin(x, cx - bw, 0, cx + bw, 0, ['#e45e44', '#b8392a', '#7e2218']);
        x.fillRect(cx - bw, ry + rt, bw * 2, story - rt);
        x.fillStyle = lin(x, 0, ry + rt, 0, ry + story, ['rgba(255,244,228,.95)', 'rgba(230,214,196,.9)']);
        const ph = story - rt - 14;
        x.fillRect(cx - bw * 0.62, ry + rt + 10, bw * 0.42, ph);
        x.fillRect(cx + bw * 0.2, ry + rt + 10, bw * 0.42, ph);
        x.fillStyle = 'rgba(126,34,24,.9)';
        x.fillRect(cx - bw * 0.62, ry + rt + 10 + ph * 0.5, bw * 0.42, 2);
        x.fillRect(cx + bw * 0.2, ry + rt + 10 + ph * 0.5, bw * 0.42, 2);
        // 高欄（手すり）
        x.fillStyle = '#5a2418'; x.fillRect(cx - bw - 6, ry + story - 6, bw * 2 + 12, 3);
        // 軒下の組物の影
        x.fillStyle = 'rgba(40,20,12,.9)';
        x.fillRect(cx - rw * 0.72, ry + rt, rw * 1.44, rt * 0.45);
        // 反りのある屋根
        x.beginPath();
        x.moveTo(cx - rw, ry + rt * 0.3);
        x.quadraticCurveTo(cx - rw * 0.75, ry + rt * 0.9, cx - rw * 0.45, ry - rt * 0.3);
        x.lineTo(cx + rw * 0.45, ry - rt * 0.3);
        x.quadraticCurveTo(cx + rw * 0.75, ry + rt * 0.9, cx + rw, ry + rt * 0.3);
        x.lineTo(cx + rw * 0.93, ry + rt);
        x.quadraticCurveTo(cx, ry + rt * 1.35, cx - rw * 0.93, ry + rt);
        x.closePath();
        x.fillStyle = lin(x, 0, ry - rt * 0.3, 0, ry + rt * 1.3, ['#6a7078', '#30343a', '#1e2125']); x.fill();
        x.strokeStyle = 'rgba(255,255,255,.2)'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(cx - rw * 0.45, ry - rt * 0.25); x.lineTo(cx + rw * 0.45, ry - rt * 0.25); x.stroke();
        // 瓦の筋
        x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 0.7;
        for (let i = -8; i <= 8; i++) { x.beginPath(); x.moveTo(cx + i * rw * 0.05, ry - rt * 0.25); x.lineTo(cx + i * rw * 0.1, ry + rt * 1.05); x.stroke(); }
      }
      // 基壇
      x.fillStyle = lin(x, 0, h - base, 0, h, ['#c4beb2', '#7d776c']);
      x.fillRect(cx - w * 0.4, h - base, w * 0.8, base);
      x.fillStyle = 'rgba(0,0,0,.15)'; x.fillRect(cx - w * 0.4, h - base, w * 0.8, 3);
    },
  },

  building: {
    w: 170, h: 450, cx: 285, grounded: true,
    build(x, w, h) {
      const L = w * 0.06, M = w * 0.62, R = w * 0.94, top = 26;
      // 左面（光が当たる）
      x.fillStyle = lin(x, 0, top, 0, h, ['#b4d6f0', '#6f9cc4', '#3c6288']);
      x.fillRect(L, top, M - L, h - top);
      // 右面（影）
      x.fillStyle = lin(x, 0, top, 0, h, ['#6d8cab', '#3d5a78', '#1f3247']);
      x.fillRect(M, top, R - M, h - top);
      // 映り込んだ雲
      x.save(); x.beginPath(); x.rect(L, top, M - L, h - top); x.clip();
      x.fillStyle = 'rgba(255,255,255,.18)';
      for (let i = 0; i < 4; i++) { x.beginPath(); x.ellipse(30 + i * 12, 90 + i * 70, 30, 10, 0, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = 'rgba(255,255,255,.12)';
      x.beginPath(); x.moveTo(L, 140); x.lineTo(M, 60); x.lineTo(M, 100); x.lineTo(L, 180); x.fill();
      x.restore();
      // 方立と床の線
      x.lineWidth = 0.8;
      for (let xx = L + 6; xx < R; xx += 6) {
        x.strokeStyle = xx < M ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.1)';
        x.beginPath(); x.moveTo(xx, top); x.lineTo(xx, h); x.stroke();
      }
      x.strokeStyle = 'rgba(10,30,50,.28)';
      for (let y = top + 8; y < h; y += 8) { x.beginPath(); x.moveTo(L, y); x.lineTo(R, y); x.stroke(); }
      // 角の線
      x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(M - 1, top, 1.5, h - top);
      // 屋上
      x.fillStyle = '#4b5864'; x.fillRect(L - 2, top - 6, R - L + 4, 6);
      x.fillStyle = '#7b8792'; x.fillRect(30, 8, 50, top - 14);
      x.fillStyle = '#5b6772'; x.fillRect(80, 8, 16, top - 14);
      x.fillStyle = '#9aa5ae'; x.fillRect(52, 0, 2, 10);
    },
    lights: [[53, 1]],
  },

  tokyotower: {
    w: 300, h: 560, cx: 78, grounded: true,
    build(x, w, h) {
      const cx = w / 2;
      const tA = Math.min(0.12, 100 / h);           // アンテナの下端（長くなりすぎないように）
      const half = t => 4 + (w / 2 - 8) * Math.pow(Math.max(0, (t - tA) / (1 - tA)), 1.3);
      // アンテナ（赤白）
      for (let i = 0; i < 8; i++) {
        x.fillStyle = i % 2 ? '#f4f1ea' : '#e5481f';
        const y0 = i * (tA * h / 8), y1 = (i + 1) * (tA * h / 8);
        const ww = 1.2 + i * 0.35;
        x.fillRect(cx - ww, y0, ww * 2, y1 - y0 + 0.5);
      }
      // 本体の輪郭
      const body = new Path2D();
      body.moveTo(cx - half(tA), tA * h);
      for (let t = tA; t <= 1.0001; t += 0.02) body.lineTo(cx + half(t), t * h);
      for (let t = 1; t >= tA - 0.0001; t -= 0.02) body.lineTo(cx - half(t), t * h);
      body.closePath();
      x.save();
      x.clip(body);
      // 塗り：赤（インターナショナルオレンジ）と白の帯
      x.fillStyle = lin(x, cx - 90, 0, cx + 90, 0, ['#ff8a5a', '#ee5326', '#c23b17', '#8c2810']);
      x.fillRect(0, 0, w, h);
      const white = lin(x, cx - 90, 0, cx + 90, 0, ['#ffffff', '#f2eee6', '#cfc8bc']);
      for (const [a, b] of [[0.13, 0.16], [0.19, 0.22], [0.31, 0.345], [0.39, 0.42], [0.47, 0.5], [0.66, 0.69], [0.78, 0.8]]) {
        x.fillStyle = white; x.fillRect(0, a * h, w, (b - a) * h);
      }
      // 鉄骨の格子
      x.strokeStyle = 'rgba(70,15,0,.45)'; x.lineWidth = 0.9;
      const step = 12;
      for (let y = tA * h; y < h; y += step) {
        const t0 = y / h, t1 = (y + step) / h;
        x.beginPath();
        x.moveTo(cx - half(t0), y); x.lineTo(cx + half(t1), y + step);
        x.moveTo(cx + half(t0), y); x.lineTo(cx - half(t1), y + step);
        x.moveTo(cx - half(t0), y); x.lineTo(cx + half(t0), y);
        x.stroke();
      }
      // 内側の脚（奥の面）を少し暗く
      x.fillStyle = 'rgba(60,10,0,.18)';
      x.beginPath();
      x.moveTo(cx - 2, tA * h); x.lineTo(cx + 2, tA * h); x.lineTo(cx + 30, h); x.lineTo(cx - 30, h); x.fill();
      x.restore();
      // 輪郭の線
      x.strokeStyle = 'rgba(110,30,5,.8)'; x.lineWidth = 1.2; x.stroke(body);
      // 脚の間のアーチを抜く
      x.save();
      x.globalCompositeOperation = 'destination-out';
      const wB = half(1);
      x.beginPath();
      x.moveTo(cx - wB * 0.7, h + 1);
      x.bezierCurveTo(cx - wB * 0.55, h - 70, cx + wB * 0.55, h - 70, cx + wB * 0.7, h + 1);
      x.fill();
      x.restore();
      x.strokeStyle = '#a8320f'; x.lineWidth = 3;
      x.beginPath();
      x.moveTo(cx - wB * 0.7, h); x.bezierCurveTo(cx - wB * 0.55, h - 70, cx + wB * 0.55, h - 70, cx + wB * 0.7, h); x.stroke();
      // 展望台
      const deck = (t, hh, extra) => {
        const y = t * h, hw = half(t) + extra;
        x.fillStyle = lin(x, 0, y, 0, y + hh, ['#ffffff', '#d9dde2', '#a9b0b8']);
        x.fillRect(cx - hw, y, hw * 2, hh);
        x.fillStyle = lin(x, cx - hw, 0, cx + hw, 0, ['#5f86b3', '#2c4a70', '#1b2f48']);
        x.fillRect(cx - hw, y + hh * 0.3, hw * 2, hh * 0.4);
        x.fillStyle = 'rgba(255,240,180,.8)';
        for (let i = cx - hw + 3; i < cx + hw - 2; i += 5) x.fillRect(i, y + hh * 0.42, 2, 1.5);
        x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(cx - hw, y + hh, hw * 2, 2);
      };
      deck(0.255, 10, 5);   // トップデッキ（250m）
      deck(0.55, 18, 9);    // メインデッキ（150m）
    },
    lights: [['c', 1]],
  },

  skytree: {
    w: 176, h: 640, cx: 285, grounded: true,
    build(x, w, h) {
      const cx = w / 2;
      const tA = Math.min(0.1, 110 / h);
      const half = t => 3.5 + (w / 2 - 10) * Math.pow(Math.max(0, (t - tA) / (1 - tA)), 1.1);
      // ゲイン塔（アンテナ）
      x.fillStyle = lin(x, cx - 4, 0, cx + 4, 0, ['#ffffff', '#c3cfda']);
      x.beginPath(); x.moveTo(cx - 0.8, 0); x.lineTo(cx + 0.8, 0); x.lineTo(cx + 3, tA * h); x.lineTo(cx - 3, tA * h); x.fill();
      x.strokeStyle = 'rgba(120,140,160,.6)'; x.lineWidth = 0.6;
      for (let y = 8; y < tA * h; y += 5) { const ww = 0.8 + 2.2 * y / (tA * h); x.beginPath(); x.moveTo(cx - ww, y); x.lineTo(cx + ww, y + 5); x.stroke(); }
      // 本体
      const body = new Path2D();
      body.moveTo(cx - half(tA), tA * h);
      for (let t = tA; t <= 1.0001; t += 0.02) body.lineTo(cx + half(t), t * h);
      for (let t = 1; t >= tA - 0.0001; t -= 0.02) body.lineTo(cx - half(t), t * h);
      body.closePath();
      x.save();
      x.clip(body);
      x.fillStyle = lin(x, cx - 60, 0, cx + 60, 0, ['#ffffff', '#e6eef5', '#b9c9d8', '#8ea3b8']);
      x.fillRect(0, 0, w, h);
      // 菱形の鉄骨（ダイヤモンドトラス）
      x.strokeStyle = 'rgba(95,120,145,.55)'; x.lineWidth = 0.8;
      const step = 14;
      for (let y = tA * h; y < h; y += step) {
        const t0 = y / h, t1 = (y + step) / h, tm = (y + step / 2) / h;
        x.beginPath();
        x.moveTo(cx - half(t0), y); x.lineTo(cx, y + step / 2); x.lineTo(cx - half(t1), y + step);
        x.moveTo(cx + half(t0), y); x.lineTo(cx, y + step / 2); x.lineTo(cx + half(t1), y + step);
        x.moveTo(cx - half(tm) * 0.5, y); x.lineTo(cx - half(tm) * 0.5, y + step);
        x.moveTo(cx + half(tm) * 0.5, y); x.lineTo(cx + half(tm) * 0.5, y + step);
        x.stroke();
      }
      // 中心の柱（心柱）
      x.fillStyle = 'rgba(160,180,200,.35)'; x.fillRect(cx - 4, tA * h, 8, h);
      x.restore();
      x.strokeStyle = 'rgba(110,135,160,.8)'; x.lineWidth = 1; x.stroke(body);
      // 展望回廊（450m）と展望デッキ（350m）
      const ring = (t, hh, extra) => {
        const y = t * h, hw = half(t) + extra;
        x.fillStyle = lin(x, 0, y, 0, y + hh, ['#ffffff', '#cfd9e2']);
        x.beginPath(); x.ellipse(cx, y, hw, 3, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = lin(x, cx - hw, 0, cx + hw, 0, ['#9ec4e6', '#3d6690', '#20354f']);
        x.fillRect(cx - hw, y, hw * 2, hh);
        x.fillStyle = 'rgba(255,255,255,.35)';
        for (let i = cx - hw + 2; i < cx + hw; i += 3) x.fillRect(i, y, 0.6, hh);
        x.fillStyle = lin(x, 0, y + hh, 0, y + hh + 4, ['#e7edf2', '#9fb0c0']);
        x.beginPath(); x.ellipse(cx, y + hh, hw, 3, 0, 0, Math.PI * 2); x.fill();
      };
      ring(0.29, 8, 6);
      ring(0.45, 20, 10);
      x.fillStyle = '#eef3f7'; x.fillRect(cx - half(0.45) - 4, 0.45 * h + 20, half(0.45) * 2 + 8, 6);
    },
    lights: [['c', 1]],
  },

  fuji: {
    labelX: 300,
    w: 460, h: 340, cx: 180,
    build(x, w, h) {
      const cx = w / 2;
      const m = new Path2D();
      m.moveTo(cx - 18, 2);
      m.quadraticCurveTo(cx - 40, h * 0.82, -10, h);
      m.lineTo(w + 10, h);
      m.quadraticCurveTo(cx + 40, h * 0.82, cx + 18, 2);
      m.quadraticCurveTo(cx, 6, cx - 18, 2);
      x.fillStyle = lin(x, 0, 0, 0, h, [[0, '#3c5a92'], [0.45, '#5a78ad'], [0.8, 'rgba(130,160,205,.55)'], [1, 'rgba(160,190,230,0)']]);
      x.fill(m);
      x.save(); x.clip(m);
      // 光の当たる側と影の側
      x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, 0, cx, h);
      x.fillStyle = 'rgba(10,20,60,.14)'; x.fillRect(cx, 0, w - cx, h);
      // 雪（ギザギザの下端と筋）
      const snowY = h * 0.32;
      x.beginPath();
      x.moveTo(0, 0); x.lineTo(w, 0); x.lineTo(w, snowY * 0.6);
      const r = mulberry(5);
      for (let xx = w; xx >= 0; xx -= 6) {
        const d = Math.abs(xx - cx) / (w / 2);
        const base = snowY * (0.55 + 0.45 * (1 - d * 0.9));
        x.lineTo(xx, base + (r() - 0.3) * 26 * (1 - d * 0.5));
      }
      x.closePath();
      x.fillStyle = lin(x, 0, 0, 0, snowY * 1.2, ['#ffffff', '#e8eef8', '#c8d4ea']); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 1.4;
      for (let i = 0; i < 26; i++) {
        const sx = cx + (r() - 0.5) * 240, len = 20 + r() * 50;
        const top = snowY * 0.7 + Math.abs(sx - cx) * 0.25;
        x.beginPath(); x.moveTo(sx, top); x.lineTo(sx + (sx - cx) * 0.12, top + len); x.stroke();
      }
      x.fillStyle = 'rgba(80,100,150,.18)'; x.fillRect(cx, 0, w - cx, snowY * 1.3);
      x.restore();
    },
  },

  everest: {
    labelX: 300,
    w: 440, h: 360, cx: 190,
    build(x, w, h) {
      const r = mulberry(31);
      const pts = [[-10, h], [20, 230], [60, 190], [100, 210], [140, 120], [170, 150], [205, 4], [240, 70], [270, 55], [300, 120], [340, 100], [380, 170], [420, 200], [w + 10, h]];
      const m = new Path2D();
      m.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) m.lineTo(p[0], p[1]);
      m.closePath();
      x.fillStyle = lin(x, 0, 0, 0, h, [[0, '#606674'], [0.5, '#7d8291'], [1, 'rgba(150,165,190,0)']]);
      x.fill(m);
      x.save(); x.clip(m);
      // 稜線ごとの影の面
      for (let i = 1; i < pts.length - 2; i++) {
        const [px, py] = pts[i], [nx, ny] = pts[i + 1];
        if (ny > py) {
          x.fillStyle = 'rgba(20,25,40,.28)';
          x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.lineTo(nx - 10, h); x.lineTo(px + 30, h); x.fill();
        }
      }
      // 雪
      x.fillStyle = 'rgba(248,251,255,.95)';
      for (let i = 1; i < pts.length - 1; i++) {
        const [px, py] = pts[i];
        if (py > 220) continue;
        const s = 30 + (220 - py) * 0.35;
        x.beginPath(); x.moveTo(px, py);
        x.lineTo(px - s * 0.6, py + s * (0.7 + r() * 0.3));
        x.lineTo(px - s * 0.2, py + s * 0.55);
        x.lineTo(px + s * 0.1, py + s * (0.9 + r() * 0.3));
        x.lineTo(px + s * 0.5, py + s * 0.6);
        x.closePath(); x.fill();
      }
      // 岩肌の筋
      x.strokeStyle = 'rgba(40,45,60,.25)'; x.lineWidth = 1;
      for (let i = 0; i < 40; i++) { const sx = r() * w, sy = 80 + r() * 200; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (r() - 0.5) * 14, sy + 20 + r() * 30); x.stroke(); }
      x.restore();
    },
  },

  iss: {
    w: 180, h: 90, cx: 265,
    build(x, w, h) {
      const cx = w / 2, cy = h / 2;
      // トラス
      x.fillStyle = lin(x, 0, cy - 3, 0, cy + 3, ['#e6e9ee', '#9aa2ad']);
      x.fillRect(8, cy - 3, w - 16, 6);
      x.strokeStyle = 'rgba(80,90,100,.6)'; x.lineWidth = 0.6;
      for (let i = 10; i < w - 10; i += 5) { x.beginPath(); x.moveTo(i, cy - 3); x.lineTo(i + 5, cy + 3); x.stroke(); }
      // 太陽電池パドル（4組）
      const panel = (px, up) => {
        const y = up ? cy - 40 : cy + 4;
        x.fillStyle = lin(x, px, y, px + 12, y + 36, ['#d9a94e', '#8a5f22', '#c4923d']);
        x.fillRect(px, y, 12, 36);
        x.strokeStyle = 'rgba(60,35,10,.6)'; x.lineWidth = 0.5;
        for (let k = 0; k < 36; k += 3) { x.beginPath(); x.moveTo(px, y + k); x.lineTo(px + 12, y + k); x.stroke(); }
        x.beginPath(); x.moveTo(px + 6, y); x.lineTo(px + 6, y + 36); x.stroke();
      };
      for (const px of [14, 30, w - 42, w - 26]) { panel(px, true); panel(px, false); }
      // 与圧モジュール
      x.fillStyle = lin(x, 0, cy - 8, 0, cy + 8, ['#ffffff', '#cfd4da', '#8d949d']);
      x.fillRect(cx - 24, cy - 6, 48, 12);
      x.fillRect(cx - 5, cy - 18, 10, 36);
      x.fillStyle = '#f2f2f2'; x.fillRect(cx + 10, cy - 22, 4, 14); x.fillRect(cx - 14, cy + 8, 4, 14);
    },
  },

  satellite: {
    w: 120, h: 70, cx: 92,
    build(x, w, h) {
      const cx = w / 2, cy = h / 2;
      const panel = px => {
        x.fillStyle = lin(x, px, cy - 9, px + 38, cy + 9, ['#3c6fb8', '#1a3462', '#2f5a99']);
        x.fillRect(px, cy - 9, 38, 18);
        x.strokeStyle = 'rgba(200,220,255,.4)'; x.lineWidth = 0.5;
        for (let k = 0; k <= 38; k += 4) { x.beginPath(); x.moveTo(px + k, cy - 9); x.lineTo(px + k, cy + 9); x.stroke(); }
        x.beginPath(); x.moveTo(px, cy); x.lineTo(px + 38, cy); x.stroke();
      };
      panel(2); panel(w - 40);
      x.fillStyle = '#9aa2ad'; x.fillRect(38, cy - 1, w - 76, 2);
      // 金色の断熱材に包まれた本体
      x.fillStyle = lin(x, cx - 12, cy - 12, cx + 12, cy + 12, ['#ffe9a0', '#d9a632', '#8a6214', '#e0b54a']);
      x.fillRect(cx - 12, cy - 13, 24, 26);
      x.strokeStyle = 'rgba(120,80,10,.5)'; x.strokeRect(cx - 12, cy - 13, 24, 26);
      // アンテナ
      x.fillStyle = lin(x, 0, 0, 0, 16, ['#ffffff', '#b9c0c8']);
      x.beginPath(); x.ellipse(cx + 2, cy - 20, 11, 5, -0.3, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#ccd'; x.beginPath(); x.moveTo(cx, cy - 13); x.lineTo(cx + 2, cy - 20); x.stroke();
    },
  },

  moon: {
    labelX: 300,
    w: 300, h: 300, cx: 255,
    build(x, w, h) {
      const cx = w / 2, cy = h / 2, R = w / 2 - 4;
      // 輝き
      x.fillStyle = rad(x, cx, cy, R * 0.9, R + 4, ['rgba(255,250,220,.25)', 'rgba(255,250,220,0)']);
      x.fillRect(0, 0, w, h);
      x.save();
      x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.clip();
      x.fillStyle = rad(x, cx, cy, R * 0.1, R, ['#fbf8ee', '#ded8c6', '#a9a393', '#6e695e'], -R * 0.35, -R * 0.35);
      x.fillRect(0, 0, w, h);
      // 海（暗い部分）
      const r = mulberry(77);
      for (const [mx, my, mr] of [[-30, -40, 50], [30, -20, 40], [10, 30, 46], [-50, 20, 30], [55, 40, 26]]) {
        x.fillStyle = rad(x, cx + mx, cy + my, 0, mr, ['rgba(110,108,100,.5)', 'rgba(110,108,100,.25)', 'rgba(110,108,100,0)']);
        x.beginPath(); x.arc(cx + mx, cy + my, mr, 0, Math.PI * 2); x.fill();
      }
      // クレーター
      for (let i = 0; i < 46; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.92;
        const kx = cx + Math.cos(a) * d, ky = cy + Math.sin(a) * d, kr = 2 + r() * r() * 14;
        x.fillStyle = 'rgba(90,85,75,.35)';
        x.beginPath(); x.arc(kx + kr * 0.15, ky + kr * 0.15, kr, 0, Math.PI * 2); x.fill();
        x.strokeStyle = 'rgba(255,252,240,.45)'; x.lineWidth = Math.max(0.6, kr * 0.15);
        x.beginPath(); x.arc(kx, ky, kr, Math.PI * 0.1, Math.PI * 1.1); x.stroke();
      }
      // ティコの光条
      x.strokeStyle = 'rgba(255,255,245,.12)'; x.lineWidth = 1.5;
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.beginPath(); x.moveTo(cx + 20, cy + 70); x.lineTo(cx + 20 + Math.cos(a) * 90, cy + 70 + Math.sin(a) * 90); x.stroke(); }
      // 影の縁
      x.fillStyle = rad(x, cx, cy, R * 0.6, R, ['rgba(0,0,0,0)', 'rgba(0,0,10,.35)'], R * 0.25, R * 0.25);
      x.fillRect(0, 0, w, h);
      x.restore();
    },
  },

  mars: {
    w: 150, h: 150, cx: 84,
    build(x, w, h) {
      const cx = w / 2, cy = h / 2, R = 62;
      planetBall(x, cx, cy, R, 'rgba(255,140,90,.35)', () => {
        x.fillStyle = rad(x, cx, cy, 0, R, ['#f6b07a', '#d8693a', '#a8401f', '#6e2410'], -R * 0.3, -R * 0.3);
        x.fillRect(0, 0, w, h);
        // 暗い模様
        const r = mulberry(31);
        for (let i = 0; i < 14; i++) {
          const mx = cx + (r() - 0.5) * R * 1.6, my = cy + (r() - 0.3) * R * 1.1;
          x.fillStyle = `rgba(90,30,14,${0.18 + r() * 0.2})`;
          x.beginPath(); x.ellipse(mx, my, 6 + r() * 18, 3 + r() * 8, r() * 3, 0, Math.PI * 2); x.fill();
        }
        // 大峡谷
        x.strokeStyle = 'rgba(80,25,10,.45)'; x.lineWidth = 3;
        x.beginPath(); x.moveTo(cx - R * 0.6, cy + 4); x.quadraticCurveTo(cx, cy - 6, cx + R * 0.5, cy + 8); x.stroke();
        // 北極の氷
        x.fillStyle = 'rgba(255,255,255,.9)';
        x.beginPath(); x.ellipse(cx - 6, cy - R * 0.9, R * 0.38, R * 0.16, -0.1, 0, Math.PI * 2); x.fill();
      });
    },
  },

  jupiter: {
    labelX: 285,
    w: 220, h: 220, cx: 268,
    build(x, w, h) {
      const cx = w / 2, cy = h / 2, R = 100;
      planetBall(x, cx, cy, R, 'rgba(255,230,190,.22)', () => {
        x.fillStyle = '#e8d2ae';
        x.fillRect(0, 0, w, h);
        // しま模様（上から：位置、太さ、色）
        const bands = [[-0.85, 0.12, '#b89a78'], [-0.6, 0.1, '#c7a27a'], [-0.38, 0.14, '#a5704a'], [-0.12, 0.08, '#f2e4c8'],
          [0.05, 0.1, '#e9d5b4'], [0.24, 0.15, '#9c6440'], [0.48, 0.09, '#c9a37c'], [0.68, 0.1, '#b28a68'], [0.88, 0.12, '#9d8266']];
        for (const [by, bh, col] of bands) {
          x.fillStyle = col;
          x.beginPath();
          const y0 = cy + by * R;
          x.moveTo(cx - R, y0 - bh * R / 2);
          for (let k = 0; k <= 20; k++) x.lineTo(cx - R + k * R / 10, y0 - bh * R / 2 + Math.sin(k * 1.7 + by * 9) * 2.5);
          for (let k = 20; k >= 0; k--) x.lineTo(cx - R + k * R / 10, y0 + bh * R / 2 + Math.sin(k * 1.3 + by * 7) * 2.5);
          x.fill();
        }
        // うずの細かい模様
        const r = mulberry(55);
        for (let i = 0; i < 40; i++) {
          x.fillStyle = r() < 0.5 ? 'rgba(255,248,230,.35)' : 'rgba(120,70,40,.25)';
          x.beginPath(); x.ellipse(cx + (r() - 0.5) * 2 * R, cy + (r() - 0.5) * 1.8 * R, 4 + r() * 10, 1.5 + r() * 2.5, 0, 0, Math.PI * 2); x.fill();
        }
        // 大赤斑
        x.fillStyle = rad(x, cx + R * 0.32, cy + R * 0.36, 2, 20, ['#e0603a', '#c0442a', 'rgba(170,70,40,.6)']);
        x.beginPath(); x.ellipse(cx + R * 0.32, cy + R * 0.36, 20, 12, 0, 0, Math.PI * 2); x.fill();
        x.strokeStyle = 'rgba(250,230,200,.6)'; x.lineWidth = 2;
        x.beginPath(); x.ellipse(cx + R * 0.32, cy + R * 0.36, 23, 14, 0, 0, Math.PI * 2); x.stroke();
      });
    },
  },

  saturn: {
    labelX: 110,
    w: 280, h: 170, cx: 100,
    build(x, w, h) {
      const cx = w / 2, cy = h / 2, R = 56, tilt = -0.32;
      // 輪（奥側も含めて全部）
      const rings = () => {
        x.save(); x.translate(cx, cy); x.rotate(tilt); x.scale(1, 0.3);
        for (const [r0, r1, col] of [[R * 1.25, R * 1.6, 'rgba(214,190,140,.75)'], [R * 1.63, R * 1.68, 'rgba(40,30,20,.2)'], [R * 1.7, R * 2.2, 'rgba(236,216,170,.85)'], [R * 2.25, R * 2.4, 'rgba(200,180,140,.55)']]) {
          x.fillStyle = col;
          x.beginPath(); x.arc(0, 0, r1, 0, Math.PI * 2); x.arc(0, 0, r0, 0, Math.PI * 2, true); x.fill();
        }
        x.restore();
      };
      rings();
      planetBall(x, cx, cy, R, null, () => {
        x.fillStyle = '#ecd9a8'; x.fillRect(0, 0, w, h);
        for (const [by, bh, col] of [[-0.7, 0.2, '#c8ad7c'], [-0.35, 0.14, '#dcc08c'], [0.1, 0.12, '#d2b27e'], [0.45, 0.18, '#bf9f70'], [0.8, 0.2, '#a98a62']]) {
          x.fillStyle = col; x.fillRect(cx - R, cy + (by - bh / 2) * R, R * 2, bh * R);
        }
        // 輪の影
        x.save(); x.translate(cx, cy); x.rotate(tilt); x.scale(1, 0.3);
        x.strokeStyle = 'rgba(60,40,20,.35)'; x.lineWidth = 10;
        x.beginPath(); x.arc(0, -40, R * 1.3, 0, Math.PI); x.stroke();
        x.restore();
      });
      // 手前側の輪を、星の上に重ねる
      x.save(); x.translate(cx, cy); x.rotate(tilt);
      x.beginPath(); x.rect(-w, 0, w * 2, h); x.clip();
      x.rotate(-tilt); x.translate(-cx, -cy);
      rings();
      x.restore();
    },
  },

  uranus: {
    labelX: 285,
    w: 130, h: 150, cx: 280,
    build(x, w, h) {
      const cx = w / 2, cy = h / 2, R = 48;
      // 縦に近い細い輪（横倒しの自転軸）
      const ring = front => {
        x.save(); x.translate(cx, cy); x.rotate(1.45); x.scale(1, 0.22);
        if (front) { x.beginPath(); x.rect(-200, 0, 400, 200); x.clip(); }
        x.strokeStyle = 'rgba(210,240,250,.55)'; x.lineWidth = 3;
        x.beginPath(); x.arc(0, 0, R * 1.45, 0, Math.PI * 2); x.stroke();
        x.restore();
      };
      ring(false);
      planetBall(x, cx, cy, R, 'rgba(170,240,250,.3)', () => {
        x.fillStyle = rad(x, cx, cy, 0, R, ['#e4fbfc', '#a8e6ec', '#6cc0cc', '#3e8f9e'], -R * 0.3, -R * 0.3);
        x.fillRect(0, 0, w, h);
        x.fillStyle = 'rgba(255,255,255,.12)';
        for (const by of [-0.5, -0.1, 0.35]) x.fillRect(cx - R, cy + by * R, R * 2, R * 0.12);
      });
      ring(true);
    },
  },

  neptune: {
    w: 130, h: 130, cx: 84,
    build(x, w, h) {
      const cx = w / 2, cy = h / 2, R = 50;
      planetBall(x, cx, cy, R, 'rgba(90,150,255,.35)', () => {
        x.fillStyle = rad(x, cx, cy, 0, R, ['#a9cbff', '#4f86f0', '#2a55c8', '#132f80'], -R * 0.3, -R * 0.3);
        x.fillRect(0, 0, w, h);
        x.fillStyle = 'rgba(20,40,120,.25)';
        for (const by of [-0.55, 0.15, 0.5]) x.fillRect(cx - R, cy + by * R, R * 2, R * 0.14);
        // 大暗斑と白い雲
        x.fillStyle = 'rgba(15,25,80,.6)';
        x.beginPath(); x.ellipse(cx - 8, cy - 4, 13, 7, -0.1, 0, Math.PI * 2); x.fill();
        x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 2.5; x.lineCap = 'round';
        x.beginPath(); x.moveTo(cx - 22, cy + 8); x.lineTo(cx - 2, cy + 7); x.stroke();
        x.beginPath(); x.moveTo(cx + 8, cy + 24); x.lineTo(cx + 24, cy + 22); x.stroke();
      });
    },
  },

  galaxy: {
    labelX: 290,
    w: 280, h: 180, cx: 180,
    build(x, w, h) {
      const cx = w / 2, cy = h / 2;
      x.save();
      x.translate(cx, cy);
      x.scale(1, 0.48);
      x.rotate(-0.3);
      x.fillStyle = rad(x, 0, 0, 0, 130, ['rgba(255,240,210,.9)', 'rgba(200,170,255,.35)', 'rgba(120,100,220,.1)', 'rgba(0,0,0,0)']);
      x.beginPath(); x.arc(0, 0, 130, 0, Math.PI * 2); x.fill();
      const r = mulberry(99);
      for (let arm = 0; arm < 2; arm++) {
        for (let i = 0; i < 700; i++) {
          const t = r();
          const a = arm * Math.PI + t * 4.4 + (r() - 0.5) * 0.5;
          const d = 8 + t * 120 + (r() - 0.5) * 14;
          const s = r() * 1.6 + 0.4;
          x.fillStyle = r() < 0.15 ? 'rgba(255,190,220,.8)' : `rgba(${200 + r() * 55 | 0},${210 + r() * 45 | 0},255,${0.4 + r() * 0.6})`;
          x.fillRect(Math.cos(a) * d, Math.sin(a) * d, s, s);
        }
      }
      x.fillStyle = rad(x, 0, 0, 0, 22, ['rgba(255,255,240,1)', 'rgba(255,230,180,0)']);
      x.beginPath(); x.arc(0, 0, 22, 0, Math.PI * 2); x.fill();
      x.restore();
    },
  },

  andromeda: {
    labelX: 290,
    w: 340, h: 180, cx: 190,
    build(x, w, h) {
      const cx = w / 2, cy = h / 2;
      x.save();
      x.translate(cx, cy);
      x.rotate(-0.55);
      x.scale(1, 0.32);
      // 円盤の光
      x.fillStyle = rad(x, 0, 0, 0, 160, ['rgba(255,244,220,1)', 'rgba(255,225,190,.75)', 'rgba(190,190,255,.35)', 'rgba(120,130,230,.12)', 'rgba(0,0,0,0)']);
      x.beginPath(); x.arc(0, 0, 160, 0, Math.PI * 2); x.fill();
      // 暗い塵の帯
      x.strokeStyle = 'rgba(40,25,30,.45)';
      for (const [r, lw] of [[60, 6], [92, 5], [124, 4]]) {
        x.lineWidth = lw;
        x.beginPath(); x.arc(0, 8, r, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
      }
      // 星
      const r = mulberry(140);
      for (let i = 0; i < 900; i++) {
        const a = r() * Math.PI * 2, d = Math.pow(r(), 0.7) * 150;
        x.fillStyle = `rgba(${220 + r() * 35 | 0},${215 + r() * 40 | 0},255,${0.25 + r() * 0.5})`;
        x.fillRect(Math.cos(a) * d, Math.sin(a) * d, 1.2, 3.2);
      }
      x.fillStyle = rad(x, 0, 0, 0, 30, ['rgba(255,255,245,1)', 'rgba(255,235,200,0)']);
      x.beginPath(); x.arc(0, 0, 30, 0, Math.PI * 2); x.fill();
      x.restore();
      // 伴銀河（M32 と M110）
      x.fillStyle = rad(x, cx + 34, cy - 4, 0, 9, ['rgba(255,245,225,.95)', 'rgba(255,235,210,0)']);
      x.beginPath(); x.arc(cx + 34, cy - 4, 9, 0, Math.PI * 2); x.fill();
      x.save(); x.translate(cx - 40, cy + 52); x.scale(1, 0.6);
      x.fillStyle = rad(x, 0, 0, 0, 16, ['rgba(255,240,220,.8)', 'rgba(255,235,210,0)']);
      x.beginPath(); x.arc(0, 0, 16, 0, Math.PI * 2); x.fill();
      x.restore();
    },
  },
};
// 直前にクリアした名所と次の目標を描く
function drawLandmarks() {
  const n = S.mode === 'collapse' || S.mode === 'result' ? (S.lastCount || 0) : S.tower.length;
  let prev = -1, next = -1;
  MILESTONES.forEach((m, i) => {
    if (!m.draw) return;
    if (m.n <= n) prev = i;
    else if (next < 0) next = i;
  });
  if (S.view) {
    // 引いたときは、地面に建つ名所だけを実際の大きさで塔の横に見せる
    if (prev >= 0 && LANDMARKS[MILESTONES[prev].draw]?.grounded) drawLandmark(prev, true, n);
    return;
  }
  if (next !== S.lmNext) { S.lmNext = next; S.lmFade = 0; }
  if (next >= 0) drawLandmark(next, false, n);
  if (prev >= 0) drawLandmark(prev, true, n);
}

function drawLandmark(idx, cleared, n) {
  const m = MILESTONES[idx];
  const realTop = toScreenY(m.n * BH);
  const remain = m.n - n;
  // 遠い目標は上の方に霞ませて見せておき、近づくと実際の高さに合わせて降りてくる
  let top = cleared ? realTop : Math.max(realTop, LM_PIN_Y);
  let alpha = 1;
  if (!cleared) {
    const fade = Math.min(1, (S.lmFade || 0) / 0.9);
    alpha = Math.max(0.45, Math.min(1, 1.05 - (remain - 1) * 0.09)) * fade;
    top += (1 - easeOutBack(fade)) * 40;
  }
  const vb = S.vb || { t: 0, b: H };
  if (top > vb.b + 20 || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const def = LANDMARKS[m.draw];
  if (def) {
    const sp = sprite(m.draw);
    const left = def.cx - sp.w / 2;
    if (top + sp.h > vb.t - 10) {
      // クリア直後は金色に光らせる
      const fx = cleared && S.clearFx && S.clearFx.idx === idx ? Math.max(0, 1 - S.clearFx.t / 1.2) : 0;
      if (fx > 0) { ctx.shadowColor = `rgba(255,215,90,${fx})`; ctx.shadowBlur = 40 * fx; }
      ctx.drawImage(sp.c, left, top, sp.w, sp.h);
      ctx.shadowBlur = 0;
      // 航空障害灯（点滅）
      if (def.lights && Math.sin(S.t * 4) > 0) {
        for (const [lx0, ly] of def.lights) {
          const lx = lx0 === 'c' ? sp.w / 2 : lx0;
          ctx.fillStyle = rad(ctx, left + lx, top + ly, 0, 6, ['rgba(255,60,40,1)', 'rgba(255,60,40,0)']);
          ctx.beginPath(); ctx.arc(left + lx, top + ly, 6, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  } else {
    drawLiveLandmark(m, top);
  }
  ctx.restore();
  // 目標ライン：届く高さが画面内に来たら線を引く
  if (!cleared && realTop > LM_PIN_Y - 30 && realTop < H) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha + 0.2);
    ctx.strokeStyle = 'rgba(255,215,90,.9)'; ctx.lineWidth = 2; ctx.setLineDash([10, 6]);
    ctx.lineDashOffset = -S.t * 20;
    ctx.beginPath(); ctx.moveTo(0, realTop); ctx.lineTo(W, realTop); ctx.stroke();
    ctx.setLineDash([]);
    const text = `目標　${m.name} ${formatAlt(m.m)}`;
    ctx.font = `700 12px ${UI_FONT}`;
    const tw = ctx.measureText(text).width + 16;
    ctx.fillStyle = 'rgba(120,70,0,.85)';
    roundRect(W - tw - 8, realTop - 22, tw, 18, 9); ctx.fill();
    ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, W - 8 - tw / 2, realTop - 13);
    ctx.restore();
  } else if (cleared && LANDMARKS[m.draw]) {
    label(`${m.name} ${formatAlt(m.m)}`, LANDMARKS[m.draw].labelX ?? LANDMARKS[m.draw].cx, realTop - 12);
  }
}

// 動きのある名所はその場で描く
function drawLiveLandmark(m, top) {
  switch (m.draw) {
    case 'plane': {
      const px = W * 0.5 + Math.sin(S.t * 0.25) * 110, py = top + 20;
      // 飛行機雲
      const g = ctx.createLinearGradient(px - 200, 0, px - 30, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.75)');
      ctx.strokeStyle = g; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px - 200, py - 2); ctx.lineTo(px - 30, py - 2); ctx.moveTo(px - 200, py + 4); ctx.lineTo(px - 30, py + 4); ctx.stroke();
      ctx.save(); ctx.translate(px, py);
      ctx.fillStyle = '#c9d2dc';
      ctx.beginPath(); ctx.moveTo(-6, 2); ctx.lineTo(10, 2); ctx.lineTo(-14, 26); ctx.lineTo(-22, 26); ctx.fill();          // 主翼（手前）
      ctx.fillStyle = lin(ctx, 0, -7, 0, 7, ['#ffffff', '#dfe5ec', '#9aa6b3']);
      ctx.beginPath(); ctx.ellipse(0, 0, 40, 6.5, 0, 0, Math.PI * 2); ctx.fill();                                           // 胴体
      ctx.fillStyle = '#c42a2a';
      ctx.beginPath(); ctx.moveTo(-30, -2); ctx.lineTo(-24, -2); ctx.lineTo(-36, -20); ctx.lineTo(-41, -20); ctx.fill();   // 尾翼
      ctx.fillStyle = '#2b4a78'; for (let i = -22; i < 26; i += 4) ctx.fillRect(i, -2.5, 2, 2);                           // 窓
      ctx.fillStyle = '#25384f'; ctx.beginPath(); ctx.ellipse(36, -1.5, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      label(`${m.name} ${formatAlt(m.m)}`, px, py + 36);
      break;
    }
    case 'stratosphere': {
      const g = ctx.createLinearGradient(0, top - 30, 0, top + 30);
      g.addColorStop(0, 'rgba(120,170,255,0)'); g.addColorStop(0.5, 'rgba(150,200,255,.35)'); g.addColorStop(1, 'rgba(120,170,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, top - 30, W, 60);
      label('ここから上は成層圏の外', W - 80, top + 22);
      break;
    }
    case 'edge': {
      const g = ctx.createLinearGradient(0, top - 40, 0, top + 10);
      g.addColorStop(0, 'rgba(255,220,120,0)'); g.addColorStop(1, 'rgba(255,220,120,.5)');
      ctx.fillStyle = g; ctx.fillRect(0, top - 40, W, 50);
      ctx.strokeStyle = 'rgba(255,230,150,.95)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(W, top); ctx.stroke();
      label('― 宇宙の果て ―', W - 80, top + 20);
      break;
    }
  }
}

// ===== ループ =====
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!manual) update(dt * timeScale);
  render();
  requestAnimationFrame(frame);
}

// ===== 入力 =====
const elTitle = document.getElementById('title');
const elResult = document.getElementById('result');
const elHud = document.getElementById('hud');
function startGame() {
  Sound.init();
  elTitle.classList.add('hidden');
  elResult.classList.add('hidden');
  elHud.classList.remove('hidden');
  resetGame();
  emit('start');
}
function toTitle() {
  elResult.classList.add('hidden');
  elHud.classList.add('hidden');
  elTitle.classList.remove('hidden');
  S.mode = 'title';
  S.tower = []; S.cur = null; S.debris = []; S.camY = 0; S.view = null; S.fakeFx = null; S.pendingCollapse = null;
  showBest();
}
document.getElementById('btnStart').addEventListener('click', startGame);
document.getElementById('btnRetry').addEventListener('click', startGame);
document.getElementById('btnTitle').addEventListener('click', toTitle);
cv.addEventListener('pointerdown', e => { e.preventDefault(); drop(); });
document.getElementById('hud').addEventListener('pointerdown', drop);
window.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (S.mode === 'play') drop();
    else if (S.mode === 'title') startGame();
    else if (S.mode === 'result') startGame();
  }
});

// ===== 確認用の入口 =====
window.__game = {
  config: CONFIG,
  milestones: MILESTONES,
  altitudeAt, formatAlt, titleAt, stability, fakeRate, swingSpeed,
  // 確認用：n 個積んだ状態から次の字を count 回選んだ結果（'f' = ニセモノ, 't' = 徳）
  sampleKinds: (n, count) => {
    const keep = S.tower, keepFake = S.lastFake;
    S.tower = Array.from({ length: n }, () => ({ x: W / 2 }));
    S.lastFake = false;
    let out = '';
    for (let i = 0; i < count; i++) out += chooseType() === 'fake' ? 'f' : 't';
    S.tower = keep; S.lastFake = keepFake;
    return out;
  },
  state: () => ({
    mode: S.mode,
    count: S.tower.length,
    camY: S.camY,
    wobble: S.wobble,
    reason: S.reason,
    endKind: S.endKind,
    finalCount: S.finalCountFixed,
    zoom: S.view ? S.view.z : 1,
    debris: S.debris.length,
    settled: S.debris.filter(d => d.settled).length,
    topX: topX(),
    cur: S.cur && { x: S.cur.x, ch: S.cur.ch, fake: S.cur.fake, state: S.cur.state, kind: S.cur.kind },
  }),
  start: startGame,
  drop,
  toTitle,
  setSeed,
  forceNext: kind => { S.forceNext = kind; },
  setTimeScale: s => { timeScale = s; },
  manual: on => { manual = on; },
  step: (dt = 1 / 60, n = 1) => { for (let i = 0; i < n; i++) update(dt); render(); },
  drainEvents: () => events.splice(0),
  audio: Sound,
  // 確認用：塔を n 個の徳で一気に作る
  buildTower: (n, jitter = 0) => {
    S.tower = Array.from({ length: n }, () => ({ x: W / 2 + (rand() - 0.5) * jitter, ch: '徳', fake: false }));
    S.lastMilestone = reachedMilestone(n).n;
    S.camY = Math.max(0, topY() - (CONFIG.groundScreenY - CONFIG.towerTopScreenY));
    S.cur = null; S.spawnTimer = 0.1; S.lastCount = n;
    updateLean();
    updateHud();
  },
};

// ===== 起動 =====
makeSky();
resize();
showBest();
requestAnimationFrame(frame);
if (document.fonts && document.fonts.load) {
  Promise.all([
    document.fonts.load(`40px "Yuji Syuku"`, '徳得特'),
    document.fonts.load(`100px "Dela Gothic One"`, '徳得特'),
  ]).then(() => { glyphCache.clear(); render(); }).catch(() => {});
}
