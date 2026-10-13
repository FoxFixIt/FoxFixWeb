/* FoxFon F1: autorski retro telefon w 3D z pełną grą w węża.
   Ładowany dopiero po otwarciu sekretu na stronie. Ekran to tekstura rysowana piksel po pikselu (84 x 48). */
import * as THREE from './three.module.min.js';

const FOX = 0xE2531E, TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const std = (color, metalness = .1, roughness = .5, x = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...x });

/* ---------------- geometria ---------------- */
function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function slab(w, h, d, r, mat, bev = .1) {
  const b = Math.min(bev, d / 3, r * .9);
  const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * b, h - 2 * b, Math.max(r - b, .02)), { depth: Math.max(d - 2 * b, .001), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 5, curveSegments: 20 });
  g.translate(0, 0, -(d - 2 * b) / 2); g.computeVertexNormals(); return new THREE.Mesh(g, mat);
}
function rrPlane(w, h, r, mat) {
  const g = new THREE.ShapeGeometry(rrShape(w, h, r), 20), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  return new THREE.Mesh(g, mat);
}
function tex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function envMap(renderer) {
  const s = new THREE.Scene(), g = new THREE.BoxGeometry();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ color: 0x5a5a5a, side: THREE.BackSide })));
  const L = (x, y, z, sx, sy, sz, i) => { const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i) })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); s.add(m); };
  L(0, 5.8, 0, 7, .1, 7, 4); L(-5.8, 1.5, 0, .1, 3, 6, 2.2); L(5.8, 1, 2, .1, 3, 3, 1.6); L(0, 1, -5.8, 6, 3, .1, 1.3); L(0, 1, 5.8, 3, 2, .1, .9);
  const pm = new THREE.PMREMGenerator(renderer), t = pm.fromScene(s, .04).texture; pm.dispose(); return t;
}

/* font 5x7 (wielkie litery) + polskie znaki jako znaczki nad/pod literą */
const F5 = {
 A:'01110100011000111111100011000110001',B:'11110100011000111110100011000111110',C:'01110100011000010000100001000101110',D:'11110100011000110001100011000111110',
 E:'11111100001000011110100001000011111',F:'11111100001000011110100001000010000',G:'01110100011000010111100011000101111',H:'10001100011000111111100011000110001',
 I:'01110001000010000100001000010001110',J:'00111000100001000010000101001001100',K:'10001100101010011000101001001010001',L:'10000100001000010000100001000011111',
 M:'10001110111010110101100011000110001',N:'10001100011100110101100111000110001',O:'01110100011000110001100011000101110',P:'11110100011000111110100001000010000',
 Q:'01110100011000110001101011001001101',R:'11110100011000111110101001001010001',S:'01111100001000001110000010000111110',T:'11111001000010000100001000010000100',
 U:'10001100011000110001100011000101110',V:'10001100011000110001100010101000100',W:'10001100011000110101101011010101010',X:'10001100010101000100010101000110001',
 Y:'10001100011000101010001000010000100',Z:'11111000010001000100010001000011111',
 0:'01110100011001110101110011000101110',1:'00100011000010000100001000010001110',2:'01110100010000100010001000100011111',3:'11111000100010000010000011000101110',
 4:'00010001100101010010111110001000010',5:'11111100001111000001000011000101110',6:'00110010001000011110100011000101110',7:'11111000010001000100010000100001000',
 8:'01110100011000101110100011000101110',9:'01110100011000101111000010001001100',
 ':':'00000011000110000000011000110000000','.':'00000000000000000000000000110001100',',':'00000000000000000000011000010001000','!':'00100001000010000100001000000000100',
 '?':'01110100010000100010001000000000100','-':'00000000000000011111000000000000000','+':'00000001000010011111001000010000000','<':'00010001000100010000010000010000010',
 '>':'01000001000001000001000100010001000','(':'00010001000100001000010000010000010',')':'01000001000001000010000100010001000','/':'00001000100001000100010001000010000','=':'00000000001111100000111110000000000',
};
const ACC = { 'Ą': ['A', 'og'], 'Ę': ['E', 'og'], 'Ć': ['C', 'ac'], 'Ń': ['N', 'ac'], 'Ó': ['O', 'ac'], 'Ś': ['S', 'ac'], 'Ź': ['Z', 'ac'], 'Ż': ['Z', 'dot'], 'Ł': ['L', 'st'] };
/* =================================================================
   GRA: wąż na ekranie 84 x 48 px
   ================================================================= */
const SW = 84, SH = 48, CELL = 3, COLS = 26, ROWS = 12, OX = 3, OY = 10;
const SPEED = [0, 330, 280, 240, 205, 175, 148, 124, 104, 88];
const FOXSPR = ['X....X', 'XX..XX', '.XXXX.'];
function makeGame(store) {
  const fb = new Uint8Array(SW * SH);
    const px = (x, y, v = 1) => { if (x >= 0 && y >= 0 && x < SW && y < SH) fb[y * SW + x] = v; };
  const rect = (x, y, w, h, v = 1) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, v); };
  const frame = (x, y, w, h) => { for (let i = 0; i < w; i++) { px(x + i, y); px(x + i, y + h - 1); } for (let j = 0; j < h; j++) { px(x, y + j); px(x + w - 1, y + j); } };
  /* tekst pikselowym fontem 5x7; y = górna krawędź komórki 9 px (wiersz na akcent, 7 na literę, wiersz na ogonek) */
  function text(str, x, y, { scale = 1, align = 'left', inv = false } = {}) {
    str = String(str).toUpperCase().replace(/…/g, '...');
    const cw = 6 * scale, w = str.length * cw - scale;
    let cx = align === 'center' ? Math.round(x - w / 2) : align === 'right' ? x - w : x;
    const v = inv ? 0 : 1, P = (i, j) => { for (let a = 0; a < scale; a++) for (let b = 0; b < scale; b++) px(cx + i * scale + a, y + j * scale + b, v); };
    for (const ch of str) {
      const [base, mark] = ACC[ch] || [ch];
      const g = F5[base];
      if (g) for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r * 5 + c] === '1') P(c, r + 1);
      if (mark === 'og') { P(3, 8); P(4, 8); } else if (mark === 'ac') { P(2, 0); P(3, 0); } else if (mark === 'dot') { P(2, 0); } else if (mark === 'st') { P(2, 3); P(1, 4); }
      cx += cw;
    }
  }
  let hs = []; try { hs = JSON.parse(store.getItem('foxfon-rekordy') || '[]'); } catch (e) { }
  let sound = true; try { sound = store.getItem('foxfon-dzwiek') !== '0'; } catch (e) { }
  let level = 5; try { level = +store.getItem('foxfon-poziom') || 5; } catch (e) { }
  const save = () => { try { store.setItem('foxfon-rekordy', JSON.stringify(hs)); store.setItem('foxfon-dzwiek', sound ? '1' : '0'); store.setItem('foxfon-poziom', level); } catch (e) { } };

  let ac = null;
  const beep = (f = 880, d = .05, type = 'square', vol = .05) => {
    if (!sound) return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = f; g.gain.value = vol; o.connect(g); g.connect(ac.destination); o.start(); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + d); o.stop(ac.currentTime + d + .02); } catch (e) { }
  };

  let state = 'boot', sel = 0, t0 = 0, acc = 0;
  let snake, dir, queue, food, bonus, eaten, score, overT, newRecord, paused;
  const MENU = () => ['Nowa gra', `Poziom: ${level}`, 'Rekordy', `Dźwięk: ${sound ? 'tak' : 'nie'}`];
  const free = (x, y) => !snake.some(s => s[0] === x && s[1] === y) && !(bonus && bonus.y === y && (bonus.x === x || bonus.x + 1 === x));
  function placeFood() { let x, y, n = 0; do { x = Math.random() * COLS | 0; y = Math.random() * ROWS | 0; n++; } while (!free(x, y) && n < 500); food = [x, y]; }
  function start() { snake = [[8, 6], [7, 6], [6, 6], [5, 6]]; dir = [1, 0]; queue = []; score = 0; eaten = 0; bonus = null; paused = false; placeFood(); state = 'play'; acc = 0; beep(660, .08); }
  function over() { state = 'dying'; overT = 0; beep(140, .45, 'sawtooth', .06);
    newRecord = score > 0 && (hs.length < 3 || score > Math.min(...hs.map(h => h.s)));
    if (newRecord) { hs.push({ s: score, l: level }); hs.sort((a, b) => b.s - a.s); hs = hs.slice(0, 3); save(); } }
  function step() {
    if (queue.length) dir = queue.shift();
    const h = [(snake[0][0] + dir[0] + COLS) % COLS, (snake[0][1] + dir[1] + ROWS) % ROWS];
    if (snake.slice(0, -1).some(s => s[0] === h[0] && s[1] === h[1])) return over();
    snake.unshift(h);
    if (h[0] === food[0] && h[1] === food[1]) {
      score += level; eaten++; beep(1320, .04); placeFood();
      if (eaten % 5 === 0 && !bonus) { let x, y, n = 0; do { x = Math.random() * (COLS - 1) | 0; y = Math.random() * ROWS | 0; n++; } while ((!free(x, y) || !free(x + 1, y)) && n < 500); bonus = { x, y, life: 20 }; }
    } else snake.pop();
    if (bonus) {
      if (h[1] === bonus.y && (h[0] === bonus.x || h[0] === bonus.x + 1)) { score += bonus.life * level; beep(1760, .12, 'triangle', .06); bonus = null; }
      else if (--bonus.life <= 0) bonus = null;
    }
  }
  function cell(x, y, kind) {
    const X = OX + x * CELL, Y = OY + y * CELL;
    if (kind === 'head') rect(X, Y, 3, 3);
    else if (kind === 'body') { rect(X, Y, 3, 3); px(X + 1, Y + 1, 0); }
    else if (kind === 'food') { px(X + 1, Y); px(X, Y + 1); px(X + 2, Y + 1); px(X + 1, Y + 2); }
  }
  function draw(time) {
    fb.fill(0);
    if (state === 'boot') {
      const k = Math.min(1, (time - t0) / 1200);
      /* lis rysowany pikselami, potem napis */
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) if (FOXSPR[j][i] === 'X') rect(30 + i * 4, 8 + j * 4, 4, 4);
      text('FOXFON', 42, 21, { scale: 2, align: 'center' });
      rect(20, 40, Math.round(44 * k), 2); frame(19, 39, 46, 4);
      if (k >= 1 && time - t0 > 1500) { state = 'menu'; sel = 0; }
      return;
    }
    if (state === 'menu' || state === 'level' || state === 'scores') {
      rect(0, 0, SW, 9); text(state === 'scores' ? 'Rekordy' : state === 'level' ? 'Poziom' : 'Wąż', 42, 0, { align: 'center', inv: true });
      if (state === 'menu') MENU().forEach((m, i) => { const y = 10 + i * 9; if (i === sel) { rect(0, y, SW, 9); text(m, 3, y, { inv: true }); } else text(m, 3, y); });
      if (state === 'level') { text(String(level), 22, 14, { scale: 2, align: 'center' }); for (let i = 1; i <= 9; i++) { const h = 2 + i * 2; rect(36 + (i - 1) * 5, 31 - h, 3, h, i <= level ? 1 : 0); if (i > level) frame(36 + (i - 1) * 5, 31 - h, 3, h); } text('< > ZMIEŃ', 42, 37, { align: 'center' }); }
      if (state === 'scores') { if (!hs.length) text('PUSTO. GRAJ!', 42, 22, { align: 'center' }); hs.forEach((h, i) => text(`${i + 1}. ${String(h.s).padStart(4, '0')} P${h.l}`, 6, 11 + i * 11)); }
      return;
    }
    /* plansza */
    text(String(score).padStart(4, '0'), 0, -1);
    if (bonus) { for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) if (FOXSPR[j][i] === 'X') px(60 + i, 1 + j); text(String(bonus.life).padStart(2, '0'), 84, -1, { align: 'right' }); }
    else text('P' + level, 84, -1, { align: 'right' });
    frame(0, 8, SW, 40); frame(1, 9, SW - 2, 38);
    const blink = state === 'dying' && Math.floor(overT / 180) % 2 === 1;
    if (!blink) snake.forEach((s, i) => cell(s[0], s[1], i ? 'body' : 'head'));
    if (Math.floor(time / 260) % 4 !== 0 || state !== 'play') cell(food[0], food[1], 'food');
    if (bonus) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) if (FOXSPR[j][i] === 'X') px(OX + bonus.x * CELL + i, OY + bonus.y * CELL + j);
    if (paused) { rect(20, 19, 44, 13, 0); frame(20, 19, 44, 13); text('PAUZA', 42, 20, { align: 'center' }); }
    if (state === 'over') {
      rect(6, 12, 72, 32, 0); frame(6, 12, 72, 32); frame(8, 14, 68, 28);
      text('KONIEC GRY', 42, 14, { align: 'center' });
      text('WYNIK ' + score, 42, 23, { align: 'center' });
      text(newRecord ? 'REKORD!' : '5 = ZNOWU', 42, 32, { align: 'center' });
    }
  }
  return {
    fb, draw,
    tick(dt, time) {
      if (state === 'boot' && !t0) t0 = time;
      if (state === 'play' && !paused) { acc += dt * 1000; const iv = SPEED[level]; while (acc >= iv && state === 'play') { acc -= iv; step(); } }
      if (state === 'dying') { overT += dt * 1000; if (overT > 1100) state = 'over'; }
    },
    input(k) {
      if (state === 'boot') { state = 'menu'; return; }
      if (state === 'menu') {
        if (k === 'up') { sel = (sel + 3) % 4; beep(990, .02); } else if (k === 'down') { sel = (sel + 1) % 4; beep(990, .02); }
        else if (k === 'ok') { beep(1200, .03); if (sel === 0) start(); else if (sel === 1) state = 'level'; else if (sel === 2) state = 'scores'; else { sound = !sound; save(); beep(1200, .05); } }
      } else if (state === 'level') {
        if (k === 'left' || k === 'down') level = Math.max(1, level - 1); else if (k === 'right' || k === 'up') level = Math.min(9, level + 1);
        else if (k === 'ok' || k === 'back') { save(); state = 'menu'; } beep(900 + level * 60, .03);
      } else if (state === 'scores') { if (k === 'ok' || k === 'back') state = 'menu'; }
      else if (state === 'play') {
        const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[k];
        if (D) { const last = queue.length ? queue[queue.length - 1] : dir; if (D[0] !== -last[0] || D[1] !== -last[1]) { if (queue.length < 2) queue.push(D); } }
        else if (k === 'ok' || k === 'pause') { paused = !paused; beep(700, .04); }
        else if (k === 'back') { state = 'menu'; }
      } else if (state === 'over') { if (k === 'ok') start(); else if (k === 'back') state = 'menu'; }
    },
    get state() { return state; },
  };
}

/* =================================================================
   TELEFON 3D
   ================================================================= */
export function createFoxFon({ canvas, store = window.localStorage, onState }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene(); scene.environment = envMap(renderer);
  const camera = new THREE.PerspectiveCamera(24, 1, .1, 200);
  const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(5, 8, 9); scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe6ff, .7); fill.position.set(-6, 2, 8); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffc7a8, 2.2); rim.position.set(-7, 4, -5); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffffff, 1.4); rim2.position.set(7, -2, -4); scene.add(rim2);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x50505a, .8));

  const W = 5.2, H = 12, D = 1.6;
  const phone = new THREE.Group(); scene.add(phone);
  const shellMat = std(0xd9481a, .3, .36), backMat = std(0x2b2f37, .3, .5), keyMat = std(0xf3ede8, .05, .45), darkMat = std(0x0e0f11, .3, .35);
  const back = slab(W, H, D * .5, 1.7, backMat, .3); back.position.z = -D * .24; phone.add(back);
  /* wymienna obudowa przednia (jak kiedyś) */
  const front = slab(W + .06, H + .06, D * .55, 1.75, shellMat, .32); front.position.z = D * .2; phone.add(front);
  const seam = new THREE.Mesh(new THREE.TorusGeometry(1, .02, 6, 64), darkMat); seam.visible = false;
  /* boczne przyciski głośności */
  for (const y of [2.4, 1.5]) { const b = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .55, 4, 10), backMat); b.position.set(-W / 2 - .02, y, 0); phone.add(b); }
  const FZ = D * .2 + D * .275; /* przednia ścianka */
  /* ramka ekranu z napisem i lisem */
  const bez = rrPlane(4.3, 3.35, .55, std(0xffffff, .2, .18, { map: tex(860, 670, (x, w, h) => {
    x.fillStyle = '#0c0d0f'; x.fillRect(0, 0, w, h);
    /* retro napis: pochylony, srebrny, wytłoczony, bez logo */
    const tx = w / 2, ty = h - 50;
    x.save(); x.translate(tx, ty); x.transform(1, 0, -.22, 1, 0, 0);
    x.font = '700 84px Geist,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.letterSpacing = '3px';
    x.fillStyle = '#000'; x.fillText('FoxFon', 2, 4);
    const sg = x.createLinearGradient(0, -52, 0, 4); sg.addColorStop(0, '#f4f5f7'); sg.addColorStop(.48, '#aeb3bb'); sg.addColorStop(.52, '#7c828c'); sg.addColorStop(1, '#d9dce1');
    x.fillStyle = sg; x.fillText('FoxFon', 0, 0);
    x.lineWidth = 1.5; x.strokeStyle = 'rgba(255,255,255,.35)'; x.strokeText('FoxFon', 0, 0);
    x.restore();
  }) }));
  bez.position.set(0, 3.05, FZ + .004); phone.add(bez);
  /* ekran LCD (tekstura gry) */
  const lc = document.createElement('canvas'); lc.width = SW * 6; lc.height = SH * 6; const lx = lc.getContext('2d');
  const lcdTex = new THREE.CanvasTexture(lc); lcdTex.colorSpace = THREE.SRGBColorSpace; lcdTex.anisotropy = 8;
  const lcdMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: lcdTex, roughness: .25, metalness: 0 }); lcdMat.toneMapped = false;
  const lcd = rrPlane(3.5, 2.0, .12, lcdMat); lcd.position.set(0, 3.32, FZ + .008); phone.add(lcd);
  const glassTop = rrPlane(4.3, 3.35, .55, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: tex(256, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(.38, 'rgba(255,255,255,.04)'); g.addColorStop(.39, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }) })); glassTop.position.set(0, 3.05, FZ + .02); phone.add(glassTop);
  /* głośniczek */
  for (let i = -3; i <= 3; i++) { const h = new THREE.Mesh(new THREE.CircleGeometry(.065, 14), darkMat); h.position.set(i * .26, 5.18 - Math.abs(i) * .025, FZ + .012); phone.add(h); }
  /* antena */
  const ant = new THREE.Mesh(new THREE.CapsuleGeometry(.32, .7, 6, 16), std(0x1b1d21, .1, .7)); ant.position.set(W / 2 - .85, H / 2 + .3, 0); phone.add(ant);

  const pressables = [];
  const press = new Map();
  const reg = (mesh, k) => { mesh.userData.k = k; pressables.push(mesh); mesh.userData.z0 = mesh.position.z; };
  /* klawisze funkcyjne */
  const soft = (x, k) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(.2, .8, 4, 12), keyMat); m.rotation.z = Math.PI / 2; m.scale.set(1, 1, .7); m.position.set(x, 1.05, FZ + .1); phone.add(m); reg(m, k); return m; };
  soft(-1.75, 'ok'); soft(1.75, 'back');
  /* krzyżak z grafiką strzałek */
  const dpadTex = tex(512, 512, (x, w) => {
    x.fillStyle = '#e9e9ec'; x.fillRect(0, 0, w, w); x.fillStyle = '#9a9ea6';
    const tri = (a) => { x.save(); x.translate(w / 2, w / 2); x.rotate(a); x.beginPath(); x.moveTo(0, -200); x.lineTo(-34, -152); x.lineTo(34, -152); x.closePath(); x.fill(); x.restore(); };
    [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(tri);
  });
  const dpad = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.04, .26, 48), [std(0xe9e9ec, .05, .45), std(0xffffff, .05, .45, { map: dpadTex }), keyMat]);
  dpad.rotation.x = Math.PI / 2; dpad.position.set(0, .55, FZ + .1); phone.add(dpad); reg(dpad, 'dpad');
  const okMat = std(0x2b2f37, .45, .35);
  const ok = new THREE.Mesh(new THREE.CylinderGeometry(.36, .38, .3, 32), okMat); ok.rotation.x = Math.PI / 2; ok.position.set(0, .55, FZ + .17); phone.add(ok); reg(ok, 'ok');
  /* klawiatura numeryczna */
  const labels = [['1', '.,?'], ['2', 'abc'], ['3', 'def'], ['4', 'ghi'], ['5', 'jkl'], ['6', 'mno'], ['7', 'pqrs'], ['8', 'tuv'], ['9', 'wxyz'], ['*', '+'], ['0', '␣'], ['#', '⇧']];
  const keyMap = { '2': 'up', '8': 'down', '4': 'left', '6': 'right', '5': 'ok', '0': 'pause', '*': 'back', '#': 'pause' };
  labels.forEach(([d, l], i) => {
    const c = i % 3, r = (i / 3) | 0;
    const kt = tex(256, 128, (x, w, h) => { x.fillStyle = d === '5' ? '#F3D9CC' : '#e9e9ec'; x.fillRect(0, 0, w, h); x.fillStyle = '#25272c'; x.font = '600 64px Geist,sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'right'; x.fillText(d, w * .5, h * .54); x.font = '500 30px Geist,sans-serif'; x.textAlign = 'left'; x.fillStyle = '#6b6f78'; x.fillText(l, w * .56, h * .56); });
    const g = new THREE.Group(); g.position.set((c - 1) * 1.5, -1.2 - r * .9 + (c === 1 ? -.12 : 0), FZ + .08); g.rotation.z = (c - 1) * -.09;
    const body = slab(1.3, .66, .28, .33, keyMat, .12); g.add(body);
    const face = rrPlane(1.08, .5, .24, std(0xffffff, .05, .45, { map: kt })); face.position.z = .141; g.add(face);
    phone.add(g); body.userData.group = g; face.userData.group = g; g.userData.z0 = g.position.z;
    [body, face].forEach(m => { m.userData.k = keyMap[d] || 'none'; m.userData.label = d; pressables.push(m); });
  });
  /* mikrofon i gniazdo */
  const mic = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .05, 12), darkMat); mic.rotation.x = Math.PI / 2; mic.position.set(0, -5.3, FZ + .005); phone.add(mic);
  const port = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .5, 4, 8), darkMat); port.rotation.z = Math.PI / 2; port.position.set(0, -H / 2 + .01, 0); port.scale.set(.5, 1, 1); phone.add(port);
  /* cień */
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const sx = sc.getContext('2d');
  const sg = sx.createRadialGradient(64, 64, 0, 64, 64, 64); sg.addColorStop(0, 'rgba(0,0,0,.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = sg; sx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -H / 2 - 1.4; shadow.scale.set(8, 3.4, 1); scene.add(shadow);

  /* ekran: piksele + delikatna siatka LCD + podświetlenie */
  const game = makeGame(store);
  const ON = '#1f2a1d', OFF = 'rgba(31,42,29,.06)';
  function paintLCD(time) {
    const g = lx.createLinearGradient(0, 0, lc.width, lc.height); g.addColorStop(0, '#b7cf9f'); g.addColorStop(1, '#93ad84');
    lx.fillStyle = g; lx.fillRect(0, 0, lc.width, lc.height);
    const fb = game.fb;
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { lx.fillStyle = fb[y * SW + x] ? ON : OFF; lx.fillRect(x * 6, y * 6, 5, 5); }
    const v = lx.createRadialGradient(lc.width / 2, lc.height / 2, lc.height * .2, lc.width / 2, lc.height / 2, lc.width * .7); v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(1, 'rgba(40,60,30,.18)');
    lx.fillStyle = v; lx.fillRect(0, 0, lc.width, lc.height);
    lcdTex.needsUpdate = true;
  }

  /* sterowanie */
  function input(k) {
    if (!k || k === 'none') return;
    game.input(k); onState?.(game.state);
  }
  const pressAnim = (obj) => { press.set(obj, 0); };
  function hitKey(name) {
    const m = pressables.find(p => p.userData.k === name || p.userData.label === name);
    if (m) pressAnim(m.userData.group || m);
  }
  const ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
  let ptr = { x: 0, y: 0 }, down = null;
  canvas.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); ptr.x = (e.clientX - r.left) / r.width - .5; ptr.y = (e.clientY - r.top) / r.height - .5; });
  canvas.addEventListener('pointerleave', () => { ptr.x = ptr.y = 0; });
  canvas.addEventListener('pointerdown', e => {
    const r = canvas.getBoundingClientRect(); v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v2, camera); const hit = ray.intersectObjects(pressables, false)[0];
    down = { x: e.clientX, y: e.clientY, hit: !!hit };
    if (!hit) return;
    let k = hit.object.userData.k;
    if (k === 'dpad') { const p = dpad.worldToLocal(hit.point.clone()); const ax = p.x, ay = -p.z; k = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : (ay > 0 ? 'up' : 'down'); }
    pressAnim(hit.object.userData.group || hit.object); input(k);
  });
  /* przesunięcie palcem po ekranie = kierunek */
  canvas.addEventListener('pointerup', e => {
    if (!down || down.hit) { down = null; return; }
    const dx = e.clientX - down.x, dy = e.clientY - down.y; down = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) { input('ok'); return; }
    input(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });

  function resize() { const r = canvas.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); const fit = 14.8 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))); camera.position.set(0, .45, Math.max(fit, fit / camera.aspect * .62)); camera.lookAt(0, .45, 0); }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  let raf = 0, last = performance.now(), t = 0, alive = true;
  phone.rotation.set(.1, -.9, 0);
  function loop(now) {
    if (!alive) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
    phone.rotation.y = damp(phone.rotation.y, -.22 + ptr.x * .5 + Math.sin(t * .6) * .05, 3, dt);
    phone.rotation.x = damp(phone.rotation.x, .06 + ptr.y * .3, 3, dt);
    phone.position.y = Math.sin(t * 1.1) * .12;
    press.forEach((k, obj) => { const nk = k + dt; press.set(obj, nk); const z0 = obj.userData.z0 ?? obj.position.z; obj.position.z = z0 - Math.sin(Math.min(nk / .14, 1) * Math.PI) * .09; if (nk > .14) { obj.position.z = z0; press.delete(obj); } });
    okMat.emissiveIntensity = .15 + (game.state === 'menu' ? Math.max(0, Math.sin(t * 3)) * .25 : 0);
    game.tick(dt, now); game.draw(now); paintLCD(now);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  return {
    cover(c) { shellMat.color.set(c.body); shellMat.metalness = c.metal ?? .5; keyMat.color.set(c.keys ?? 0xe9e9ec); },
    input(k) { input(k); hitKey({ up: '2', down: '8', left: '4', right: '6', ok: '5', back: '*', pause: '0' }[k] || k); },
    destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); },
  };
}
