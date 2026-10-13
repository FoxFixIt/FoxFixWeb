/* FoxFix – studio 3D diagnosty. Ładowane leniwie (dopiero gdy sekcja jest blisko ekranu).
   Każde urządzenie zbudowane z prymitywów three.js – zero zewnętrznych modeli. */
import * as THREE from './three.module.min.js';

const FOX = 0xE2531E, TAU = Math.PI * 2, CAP = /[?&]test\b/.test(location.search) ? .5 : .05;
const FOX_D = 'M6 6 50 94 94 6M6 6l22 11M94 6 72 17M50 6 19.6 33.3M50 6l30.4 27.3M15.5 38 3 50.5 50 94M84.5 38 97 50.5 50 94';
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const ease = t => (t = Math.min(Math.max(t, 0), 1), t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const std = (color, metalness = .1, roughness = .5, x = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...x });
const glow = (color = FOX) => std(color, 0, .4, { emissive: color, emissiveIntensity: 0 });

/* ---------- geometria ---------- */
function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function slab(w, h, d, r, mat, bev = .1) {
  const b = Math.min(bev, d / 3, r * .9);
  const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * b, h - 2 * b, Math.max(r - b, .02)),
    { depth: Math.max(d - 2 * b, .001), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 5, curveSegments: 18 });
  g.translate(0, 0, -(d - 2 * b) / 2); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
function rrPlane(w, h, r, mat) {
  const g = new THREE.ShapeGeometry(rrShape(w, h, r), 20), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  return new THREE.Mesh(g, mat);
}
function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cyl(r, h, mat, seg = 40) { return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); }
/* obrys „rentgena” – dwie pętle linii (przód i tył) */
function outline(w, h, r, d, mat) {
  const pts = rrShape(w, h, r).getPoints(20).map(p => new THREE.Vector3(p.x, p.y, 0));
  const g = new THREE.BufferGeometry().setFromPoints(pts), o = new THREE.Group();
  for (const z of [d / 2, -d / 2]) { const l = new THREE.LineLoop(g, mat); l.position.z = z; o.add(l); }
  return o;
}
function fan(r, mat, bladeMat) {
  const f = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * .07, 8, 48), mat); f.add(ring);
  const hub = cyl(r * .28, r * .25, mat); hub.rotation.x = Math.PI / 2; f.add(hub);
  const blades = new THREE.Group(); f.add(blades); f.userData.blades = blades;
  for (let i = 0; i < 7; i++) {
    const b = box(r * .62, r * .26, r * .04, bladeMat); b.position.x = r * .55;
    const p = new THREE.Group(); p.rotation.z = i / 7 * TAU; b.rotation.x = .5; p.add(b); blades.add(p);
  }
  return f;
}
/* pasek zegarka – prostopadłościan wygięty po łuku */
function strap(w, len, t, R, mat, dir) {
  const g = new THREE.BoxGeometry(w, len, t, 1, 28, 1); g.translate(0, len / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), z = p.getZ(i), a = y / R, rr = R - z;
    p.setXYZ(i, p.getX(i), rr * Math.sin(a) * dir, -(R - rr * Math.cos(a)));
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

/* ---------- ekran (canvas → tekstura) ---------- */
class Screen {
  constructor(w, h, res = 1024) {
    this.c = document.createElement('canvas');
    if (w < h) { this.c.height = res; this.c.width = Math.round(res * w / h); } else { this.c.width = res; this.c.height = Math.round(res * h / w); }
    this.x = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: this.tex, roughness: .14, metalness: 0 });
    this.mat.toneMapped = false;
  }
  flush() { this.tex.needsUpdate = true; }
}
const foxPath = new Path2D(FOX_D);
function drawFox(x, cx, cy, size, color, lw = 7) {
  x.save(); x.translate(cx - size / 2, cy - size / 2); x.scale(size / 100, size / 100);
  x.strokeStyle = color; x.lineWidth = lw; x.lineCap = 'round'; x.lineJoin = 'round'; x.stroke(foxPath); x.restore();
}
function rnd(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function makeCracks(cx, cy, scale, seed = 7) {
  const r = rnd(seed), segs = [];
  const branch = (x, y, ang, len, depth, d0) => {
    let px = x, py = y, d = d0;
    const n = 5 + (r() * 4 | 0);
    for (let i = 0; i < n; i++) {
      ang += (r() - .5) * .7; const l = len / n * (0.6 + r() * .8);
      const nx = px + Math.cos(ang) * l, ny = py + Math.sin(ang) * l;
      segs.push([px, py, nx, ny, d]); d += l;
      if (depth < 2 && r() < .28) branch(nx, ny, ang + (r() < .5 ? -1 : 1) * (0.6 + r() * .6), len * .45, depth + 1, d);
      px = nx; py = ny;
    }
  };
  const N = 9;
  for (let i = 0; i < N; i++) branch(cx, cy, i / N * TAU + r() * .4, scale * (0.55 + r() * .7), 0, 0);
  const ring = []; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, rr = scale * (.05 + r() * .05); ring.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return { segs, ring, max: Math.max(...segs.map(s => s[4])) };
}
function drawCracks(x, cr, p, w) {
  const k = ease(Math.min(p / .45, 1)) * cr.max;
  x.save(); x.lineCap = 'round';
  x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = w * .012;
  for (const s of cr.segs) if (s[4] < k) { x.beginPath(); x.moveTo(s[0], s[1]); x.lineTo(s[2], s[3]); x.stroke(); }
  x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = w * .0035;
  for (const s of cr.segs) if (s[4] < k) { x.beginPath(); x.moveTo(s[0], s[1]); x.lineTo(s[2], s[3]); x.stroke(); }
  if (p > .05) { x.beginPath(); cr.ring.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath(); x.fillStyle = 'rgba(255,255,255,.22)'; x.fill(); x.stroke(); }
  x.restore();
}
function drawProgress(x, w, h, p, t, label) {
  x.fillStyle = 'rgba(8,8,10,.82)'; x.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h * .44, R = Math.min(w, h) * .12;
  x.lineWidth = R * .16; x.lineCap = 'round';
  x.strokeStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.stroke();
  x.strokeStyle = '#E2531E'; x.beginPath(); x.arc(cx, cy, R, t * 4, t * 4 + 1.6); x.stroke();
  const v = (p * 23 % 100) | 0, bw = w * .56;
  x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(cx - bw / 2, cy + R * 1.8, bw, R * .14);
  x.fillStyle = '#E2531E'; x.fillRect(cx - bw / 2, cy + R * 1.8, bw * v / 100, R * .14);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = `700 ${R * .36}px "Geist Mono",monospace`;
  x.fillText(`${label} ${v}%`, cx, cy + R * 2.6);
}
function drawBattery(x, w, h, level, t, bolt) {
  x.fillStyle = 'rgba(8,8,10,.86)'; x.fillRect(0, 0, w, h);
  const bw = w * .36, bh = bw * .5, cx = w / 2, cy = h * .45;
  x.strokeStyle = '#fff'; x.lineWidth = bw * .05; x.lineJoin = 'round';
  x.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh); x.fillStyle = '#fff'; x.fillRect(cx + bw / 2 + bw * .03, cy - bh * .18, bw * .06, bh * .36);
  x.fillStyle = level < .2 ? '#E2531E' : '#7BD389';
  x.fillRect(cx - bw / 2 + bw * .07, cy - bh / 2 + bw * .07, (bw - bw * .14) * level, bh - bw * .14);
  if (bolt && Math.sin(t * 6) > 0) {
    x.fillStyle = '#E2531E'; x.beginPath(); const s = bh * .5;
    x.moveTo(cx + s * .1, cy - s); x.lineTo(cx - s * .45, cy + s * .1); x.lineTo(cx - s * .02, cy + s * .1); x.lineTo(cx - s * .15, cy + s); x.lineTo(cx + s * .45, cy - s * .1); x.lineTo(cx + s * .02, cy - s * .1); x.closePath(); x.fill();
  }
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = `700 ${bw * .16}px "Geist Mono",monospace`;
  x.fillText(bolt ? 'ładuje? …nie bardzo' : `${Math.round(level * 100)}% · puchnie`, cx, cy + bh * 1.25);
}
function drawWater(x, w, h, p, t) {
  const lvl = h * (1 - .62 * ease(Math.min(p / 1.6, 1)));
  const gr = x.createLinearGradient(0, lvl, 0, h); gr.addColorStop(0, 'rgba(90,160,215,.75)'); gr.addColorStop(1, 'rgba(30,80,140,.9)');
  x.fillStyle = gr; x.beginPath(); x.moveTo(0, h);
  for (let i = 0; i <= 40; i++) { const xx = i / 40 * w; x.lineTo(xx, lvl + Math.sin(i * .6 + t * 3) * h * .008 + Math.sin(i * .23 - t * 2) * h * .006); }
  x.lineTo(w, h); x.closePath(); x.fill();
  x.fillStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i < 14; i++) { const bx = (i * 97 % 100) / 100 * w, sp = .3 + (i % 5) * .12, by = h - ((t * sp * 200 + i * 130) % (h - lvl + 1)); x.beginPath(); x.arc(bx, by, w * (.006 + (i % 3) * .004), 0, TAU); x.fill(); }
}
function clockStr() { const d = new Date(); return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }); }
function dateStr() { return new Date().toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' }); }
function lockScreen(x, w, h, island) {
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1b1c20'); g.addColorStop(1, '#0a0a0c');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const rg = x.createRadialGradient(w * .5, h * .62, 0, w * .5, h * .62, w * .7); rg.addColorStop(0, 'rgba(226,83,30,.22)'); rg.addColorStop(1, 'rgba(226,83,30,0)');
  x.fillStyle = rg; x.fillRect(0, 0, w, h);
  if (island) { x.fillStyle = '#000'; const iw = w * .3, ih = w * .085; x.beginPath(); x.roundRect(w / 2 - iw / 2, h * .022, iw, ih, ih / 2); x.fill(); }
  x.fillStyle = '#fff'; x.textAlign = 'center';
  x.font = `600 ${w * .055}px Geist,sans-serif`; x.globalAlpha = .7; x.fillText(dateStr(), w / 2, h * .13); x.globalAlpha = 1;
  x.font = `700 ${w * .22}px Geist,sans-serif`; x.fillText(clockStr(), w / 2, h * .13 + w * .23);
  drawFox(x, w / 2, h * .6, w * .34, '#E2531E');
  x.font = `400 ${w * .042}px "Geist Mono",monospace`; x.globalAlpha = .55; x.fillText('dziwne… u nas działa', w / 2, h * .9); x.globalAlpha = 1;
}

/* ---------- materiały wspólne ---------- */
function mats() {
  return {
    frame: std(0x3a3c41, .85, .3), back: std(0x26282c, .3, .28), ink: std(0x0c0c0e, .2, .6),
    lens: std(0x0d1522, .9, .1), alu: std(0xc6c8cb, .85, .3), dark: std(0x151619, .35, .55),
    board: std(0x1f3a30, .3, .6), chip: std(0x2b2d31, .5, .4), bat: std(0x9da2a8, .4, .45),
    copper: std(0xb87333, .9, .3), white: std(0xf2f2ef, .1, .45),
    line: new THREE.LineBasicMaterial({ color: FOX, transparent: true, opacity: 0 }),
  };
}

/* ---------- efekty pomocnicze ---------- */
function rings(n, r, mat, parent, pos, rot) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const m = mat.clone(); m.transparent = true;
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, r * .05, 8, 48), m); t.position.copy(pos); if (rot) t.rotation.copy(rot);
    t.visible = false; parent.add(t); arr.push(t);
  }
  return {
    on(t) { arr.forEach((o, i) => { const k = ((t * .9 + i / n) % 1); o.visible = true; o.scale.setScalar(.6 + k * 1.8); o.material.opacity = (1 - k) * .9; o.material.emissiveIntensity = 1.4; }); },
    off() { arr.forEach(o => o.visible = false); }
  };
}
function dust(parent, n, color = 0xb59a74) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) seed[i] = Math.random();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color, size: .22, transparent: true, opacity: .85, depthWrite: false });
  const pts = new THREE.Points(g, m); pts.visible = false; parent.add(pts);
  return {
    /* origin: Vector3, dir: Vector3, spread */
    on(t, origin, dir, spread = 1, len = 6) {
      pts.visible = true;
      for (let i = 0; i < n; i++) {
        const k = (t * .35 + seed[i]) % 1, s = seed[i] * 97;
        pos[i * 3] = origin.x + dir.x * k * len + Math.sin(s) * spread * (0.3 + k);
        pos[i * 3 + 1] = origin.y + dir.y * k * len + Math.cos(s * 1.3) * spread * (0.3 + k) + k * k * 1.5;
        pos[i * 3 + 2] = origin.z + dir.z * k * len + Math.sin(s * .7) * spread * (0.3 + k);
      }
      g.attributes.position.needsUpdate = true; m.opacity = .85;
    },
    off() { pts.visible = false; }
  };
}

/* ======================================================================
   URZĄDZENIA
   Każde zwraca: { root, model, rest:[rx,ry], issues:{id:{rot,zoom,focus,xray,anchor,normal,update,exit}}, tick(dt,t,issue,p), shell[], lines, inner }
   ====================================================================== */

function handheld(kind) {
  const M = mats();
  const P = kind === 'tablet'
    ? { W: 17.8, H: 25, D: .62, R: 1.6, sw: 16.7, sh: 23.9, sr: 1.0 }
    : { W: 7.2, H: 15, D: .82, R: 1.15, sw: 6.78, sh: 14.58, sr: .98 };
  const { W, H, D } = P;
  const model = new THREE.Group();
  const body = slab(W, H, D, P.R, M.frame, kind === 'tablet' ? .1 : .14); model.add(body);
  const back = rrPlane(W - .32, H - .32, P.R - .1, M.back); back.position.z = -D / 2 - .002; back.rotation.y = Math.PI; model.add(back);
  const scr = new Screen(P.sw, P.sh, 1024);
  const sm = rrPlane(P.sw, P.sh, P.sr, scr.mat); sm.position.z = D / 2 + .004; model.add(sm);

  /* aparat */
  const cam = new THREE.Group(); model.add(cam);
  const lensDefs = kind === 'tablet' ? [[0, 0]] : [[-.78, .78], [-.78, -.78], [.78, 0]];
  const bumpS = kind === 'tablet' ? 1.6 : 3.15;
  cam.position.set(kind === 'tablet' ? -W / 2 + 1.9 : -W / 2 + 1.85, H / 2 - (kind === 'tablet' ? 1.9 : 2.25), -D / 2);
  const bump = slab(bumpS, bumpS, .2, bumpS * .26, M.back, .06); bump.position.z = -.1; cam.add(bump);
  const lensRingPos = [];
  for (const [x, y] of lensDefs) {
    const o = cyl(.58, .22, M.frame); o.rotation.x = Math.PI / 2; o.position.set(x, y, -.27); cam.add(o);
    const l = new THREE.Mesh(new THREE.CircleGeometry(.43, 40), M.lens); l.position.set(x, y, -.385); l.rotation.y = Math.PI; cam.add(l);
    lensRingPos.push(new THREE.Vector3(x, y, -.4));
  }
  if (kind !== 'tablet') { const fl = new THREE.Mesh(new THREE.CircleGeometry(.2, 24), M.white); fl.position.set(.8, .95, -.205); fl.rotation.y = Math.PI; cam.add(fl); }
  const camRings = lensRingPos.map(p => rings(2, .66, glow(), cam, p));

  /* przyciski */
  const btns = [];
  const btn = (x, y, z, w, h, d) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(Math.min(w, d) / 2, Math.max(h - Math.min(w, d), .01), 4, 12), M.frame); m.position.set(x, y, z); if (w > h) m.rotation.z = Math.PI / 2; model.add(m); btns.push(m); return m; };
  if (kind === 'tablet') { btn(W / 2 - 2.6, H / 2 + .02, 0, 2.2, .3, .28); btn(W / 2 + .02, H / 2 - 3.2, 0, .3, 1.8, .28); btn(W / 2 + .02, H / 2 - 5.4, 0, .3, 1.8, .28); }
  else { btn(W / 2 + .03, 2.8, 0, .3, 2.0, .3); btn(-W / 2 - .03, 3.5, 0, .3, 1.25, .3); btn(-W / 2 - .03, 1.85, 0, .3, 1.25, .3); btn(-W / 2 - .03, 5.25, 0, .3, .65, .3); }
  const btnMat = glow();
  const btnHome = btns.map(b => b.position.clone());

  /* port + głośniki */
  const portMat = std(0x050506, .2, .6, { emissive: FOX, emissiveIntensity: 0 });
  const port = new THREE.Mesh(new THREE.CapsuleGeometry(.14, kind === 'tablet' ? .8 : .7, 4, 12), portMat);
  port.rotation.z = Math.PI / 2; port.scale.set(1, 1, .9); port.position.set(0, -H / 2 + .02, 0); model.add(port);
  const grille = [];
  for (const s of [-1, 1]) for (let i = 0; i < (kind === 'tablet' ? 6 : 5); i++) {
    const h = cyl(.075, .06, M.ink, 12); h.position.set(s * (kind === 'tablet' ? 4 + i * .35 : 1.25 + i * .3), -H / 2 - .005, 0); model.add(h); grille.push(h);
  }
  const spk = rings(3, .5, glow(), model, new THREE.Vector3(kind === 'tablet' ? 4.9 : 1.85, -H / 2 - .3, 0), new THREE.Euler(Math.PI / 2, 0, 0));
  const spk2 = rings(3, .5, glow(), model, new THREE.Vector3(kind === 'tablet' ? -4.9 : -1.85, -H / 2 - .3, 0), new THREE.Euler(Math.PI / 2, 0, 0));
  const portLight = new THREE.PointLight(FOX, 0, 6); portLight.position.set(0, -H / 2 - .6, .5); model.add(portLight);

  /* kabel USB-C */
  const plug = new THREE.Group(); plug.visible = false; model.add(plug);
  const pb = slab(1.25, 2.4, .62, .3, M.white, .12); pb.position.y = -1.2; plug.add(pb);
  const tip = box(.6, .5, .22, M.alu); tip.position.y = .2; plug.add(tip);
  const cable = cyl(.2, 8, M.white, 16); cable.position.y = -6.4; plug.add(cable);

  /* krople */
  const dropMat = std(0x6fa8dc, .1, .05, { transparent: true, opacity: .85 });
  const drops = Array.from({ length: 7 }, () => { const d = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 12), dropMat); d.scale.y = 1.35; d.visible = false; model.add(d); return d; });

  /* środek (rentgen) */
  const inner = new THREE.Group(); inner.visible = false; model.add(inner);
  const batMat = M.bat;
  const bats = kind === 'tablet'
    ? [[-3.9, -2.5, 6.8, 13], [3.9, -2.5, 6.8, 13]] : [[0, -2.4, 5.4, 7.6]];
  const batMeshes = bats.map(([x, y, w, h]) => { const b = slab(w, h, D * .45, .5, batMat, .08); b.position.set(x, y, -.05); inner.add(b); return b; });
  const brd = slab(kind === 'tablet' ? 14 : 5.8, kind === 'tablet' ? 5 : 4.4, .1, .3, M.board, .03); brd.position.set(0, kind === 'tablet' ? 8.8 : 4.4, 0); inner.add(brd);
  for (let i = 0; i < 4; i++) { const c = box(.9 + (i % 2) * .5, .9, .14, M.chip); c.position.set((i - 1.5) * 1.3 * (kind === 'tablet' ? 2.5 : 1), (kind === 'tablet' ? 8.8 : 4.4) + (i % 2 ? .6 : -.6), .1); inner.add(c); }
  const lines = outline(W, H, P.R, D, M.line); model.add(lines);

  const root = new THREE.Group(); root.add(model);
  const cr = makeCracks(scr.c.width * .62, scr.c.height * .3, scr.c.width * 1.1, kind === 'tablet' ? 3 : 7);

  const dev = {
    root, model, scr, shell: [M.frame, M.back, M.ink, M.lens, scr.mat], lines, inner,
    rest: [.08, -.38], drawn: 0,
    draw(t, id, p) {
      const x = scr.x, w = scr.c.width, h = scr.c.height;
      lockScreen(x, w, h, kind !== 'tablet');
      if (id === 'ekran') drawCracks(x, cr, p, w);
      else if (id === 'bateria') drawBattery(x, w, h, Math.max(.03, .62 - p * .25), t, false);
      else if (id === 'port') drawBattery(x, w, h, .08, t, true);
      else if (id === 'zalanie') drawWater(x, w, h, p, t);
      else if (id === 'oprogramowanie') drawProgress(x, w, h, p, t, 'Aktualizacja…');
      scr.flush();
    },
    issues: {
      ekran: { rot: [.04, -.22], zoom: 1.05, anchor: [W * .12, H * .2, D / 2], normal: [0, 0, 1] },
      bateria: {
        rot: [.12, Math.PI - .4], xray: 1, anchor: [bats[0][0], bats[0][1], -D / 2], normal: [0, 0, -1],
        update(dt, t, p) { const k = Math.min(p / 2, 1); batMat.color.setRGB(lerp(.62, .89, k), lerp(.64, .33, k), lerp(.66, .12, k)); batMeshes.forEach(b => b.scale.z = 1 + Math.max(0, Math.sin(t * 2.4)) * .9 * k); },
        exit() { batMat.color.set(0x9da2a8); batMeshes.forEach(b => b.scale.z = 1); }
      },
      port: {
        rot: [-1.12, -.25], zoom: 1.55, focus: [0, -H / 2, 0], anchor: [0, -H / 2, 0], normal: [0, -1, 0],
        update(dt, t, p) {
          plug.visible = true; const c = (Math.sin(t * 2.2) + 1) / 2, inPos = c > .45 ? 0 : (.45 - c) * 4;
          plug.position.set(0, -H / 2 - .2 - inPos, 0); plug.rotation.z = c > .45 ? Math.sin(t * 9) * .12 : 0;
          const spark = c > .45 && Math.sin(t * 23) > .2 ? 1 : 0; portMat.emissiveIntensity = spark * 2; portLight.intensity = spark * 40;
        },
        exit() { plug.visible = false; portMat.emissiveIntensity = 0; portLight.intensity = 0; }
      },
      aparat: {
        rot: [.16, Math.PI + .32], zoom: kind === 'tablet' ? 2.2 : 1.6, focus: [cam.position.x, cam.position.y, -D / 2], anchor: [cam.position.x, cam.position.y, -D / 2 - .3], normal: [0, 0, -1],
        update(dt, t) { camRings.forEach((r, i) => r.on(t + i * .3)); }, exit() { camRings.forEach(r => r.off()); }
      },
      zalanie: {
        rot: [.06, .22], anchor: [-W * .25, -H * .28, D / 2], normal: [0, 0, 1],
        update(dt, t, p) {
          drops.forEach((d, i) => { const k = (t * .55 + i / drops.length) % 1; d.visible = true; d.position.set((i / drops.length - .5) * W * .9, H / 2 + 2 - k * (H + 4), D / 2 + .6 + (i % 3) * .3); d.material.opacity = .85 * Math.sin(k * Math.PI); });
        },
        exit() { drops.forEach(d => d.visible = false); }
      },
      przyciski: {
        rot: kind === 'tablet' ? [1.15, -.2] : [.12, -1.18], zoom: kind === 'tablet' ? 1.5 : 1.45,
        focus: kind === 'tablet' ? [W / 2 - 2.6, H / 2, 0] : [W / 2, 2.8, 0],
        anchor: kind === 'tablet' ? [W / 2 - 2.6, H / 2 + .15, 0] : [W / 2 + .15, 2.8, 0], normal: kind === 'tablet' ? [0, 1, 0] : [1, 0, 0],
        update(dt, t) { const b = btns[0], k = Math.max(0, Math.sin(t * 7)); b.material = btnMat; btnMat.emissiveIntensity = .4 + k; if (kind === 'tablet') b.position.y = btnHome[0].y - k * .12; else b.position.x = btnHome[0].x - k * .12; },
        exit() { btns[0].material = M.frame; btns[0].position.copy(btnHome[0]); }
      },
      glosnik: {
        rot: [-1.12, .25], zoom: 1.5, focus: [0, -H / 2, 0], anchor: [1.85, -H / 2, 0], normal: [0, -1, 0],
        update(dt, t) { spk.on(t); spk2.on(t + .5); }, exit() { spk.off(); spk2.off(); }
      },
      oprogramowanie: { rot: [0, .16], anchor: [-W * .2, H * .05, D / 2], normal: [0, 0, 1] },
    },
  };
  if (kind === 'tablet') { delete dev.issues.aparat; delete dev.issues.glosnik; delete dev.issues.zalanie; }
  return dev;
}

function laptop() {
  const M = mats(); const W = 30, Dp = 21, T = 1.4;
  const model = new THREE.Group();
  const base = slab(W, Dp, T, 1.2, M.alu, .3); base.rotation.x = -Math.PI / 2; base.position.y = T / 2; model.add(base);
  const lidMat = M.alu.clone();
  const well = rrPlane(27.6, 10.4, .5, M.dark); well.rotation.x = -Math.PI / 2; well.position.set(0, T + .003, -3.4); model.add(well);
  const keyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .65, metalness: .1 });
  const rows = 5, cols = 14, keys = new THREE.InstancedMesh(new THREE.BoxGeometry(1.62, .2, 1.5), keyMat, rows * cols + 1);
  const dummy = new THREE.Object3D(), keyBase = [], cKey = new THREE.Color(0x1c1d20), cHot = new THREE.Color(FOX);
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { keyBase.push([(c - (cols - 1) / 2) * 1.88, T + .12, -7.4 + r * 1.78, 1]); }
  keyBase.push([0, T + .12, -7.4 + rows * 1.78, 5.5]);
  keyBase.forEach(([x, y, z, sx], i) => { dummy.position.set(x, y, z); dummy.scale.set(sx, 1, 1); dummy.updateMatrix(); keys.setMatrixAt(i, dummy.matrix); keys.setColorAt(i, cKey); });
  model.add(keys);
  const pad = rrPlane(11, 6.6, .5, M.alu.clone()); pad.material.color.set(0xb4b6b9); pad.rotation.x = -Math.PI / 2; pad.position.set(0, T + .004, 6.3); model.add(pad);

  /* klapa */
  const pivot = new THREE.Group(); pivot.position.set(0, T, -Dp / 2 + .45); model.add(pivot);
  const lid = slab(W, 20, .55, 1.2, lidMat, .2); lid.position.set(0, 10, -.3); pivot.add(lid);
  const bez = rrPlane(29.3, 19.3, 1.0, M.dark); bez.position.set(0, 10, .0); pivot.add(bez);
  const scr = new Screen(27.4, 17.1, 1024);
  const sm = rrPlane(27.4, 17.1, .3, scr.mat); sm.position.set(0, 10.55, .01); pivot.add(sm);
  const camDot = new THREE.Mesh(new THREE.CircleGeometry(.18, 16), M.lens); camDot.position.set(0, 19.35, .012); pivot.add(camDot);
  const hinge = cyl(.42, 22, M.dark, 20); hinge.rotation.z = Math.PI / 2; hinge.position.set(0, T, -Dp / 2 + .45); model.add(hinge);
  const lidLogoMat = new THREE.LineBasicMaterial({ color: 0x8d9095 });
  { const pts = []; const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path'); tmp.setAttribute('d', FOX_D);
    /* logo na tylnej klapie: odcinki z FOX_D */
    const segs = [[6, 6, 50, 94], [50, 94, 94, 6], [6, 6, 28, 17], [94, 6, 72, 17], [50, 6, 19.6, 33.3], [50, 6, 80.4, 33.3], [15.5, 38, 3, 50.5], [3, 50.5, 50, 94], [84.5, 38, 97, 50.5], [97, 50.5, 50, 94]];
    segs.forEach(([a, b, c, d]) => { pts.push(new THREE.Vector3((a - 50) * .05, (50 - b) * .05, 0), new THREE.Vector3((c - 50) * .05, (50 - d) * .05, 0)); });
    const lg = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lidLogoMat); lg.position.set(0, 10, -.59); lg.rotation.y = Math.PI; pivot.add(lg); }

  /* porty */
  const portMat = std(0x050506, .2, .6, { emissive: FOX, emissiveIntensity: 0 });
  const usb = new THREE.Mesh(new THREE.CapsuleGeometry(.16, .62, 4, 12), portMat); usb.rotation.x = Math.PI / 2; usb.scale.set(.6, 1, 1); usb.position.set(-W / 2 + .02, T * .5, -4.2); model.add(usb);
  const usb2 = usb.clone(); usb2.material = M.ink; usb2.position.z = -6.4; model.add(usb2);
  const vents = []; for (let i = 0; i < 9; i++) { const v = box(1.1, .22, .06, M.ink); v.position.set(-12 + i * 1.45, .55, -Dp / 2 - .01); model.add(v); vents.push(v); }
  const plug = new THREE.Group(); plug.visible = false; model.add(plug);
  { const pb = slab(2.2, 1.0, .6, .3, M.white, .12); pb.rotation.y = Math.PI / 2; pb.rotation.z = Math.PI / 2; pb.position.x = -1.1; plug.add(pb);
    const tp = box(.5, .2, .55, M.alu); tp.position.x = .2; plug.add(tp); const cb = cyl(.18, 8, M.white, 12); cb.rotation.z = Math.PI / 2; cb.position.x = -6.1; plug.add(cb); }
  const portLight = new THREE.PointLight(FOX, 0, 6); portLight.position.set(-W / 2 - .8, T * .5, -4.2); model.add(portLight);

  /* środek */
  const inner = new THREE.Group(); inner.visible = false; model.add(inner);
  const brd = box(27, .1, 9, M.board); brd.position.set(0, .35, -5.4); inner.add(brd);
  const fHouse = cyl(2.5, .8, M.dark); fHouse.position.set(-8.5, .7, -6.3); inner.add(fHouse);
  const fn = fan(2.2, M.chip, std(0x3d4046, .3, .5)); fn.rotation.x = -Math.PI / 2; fn.position.set(-8.5, 1.15, -6.3); inner.add(fn);
  const pipe = box(8, .18, .7, M.copper); pipe.position.set(-2.8, .9, -6.3); inner.add(pipe);
  const cpu = box(2.6, .22, 2.6, M.chip); cpu.position.set(1.4, .55, -6.0); inner.add(cpu);
  const batt = slab(25, 7.2, .8, .4, M.bat, .1); batt.rotation.x = -Math.PI / 2; batt.position.set(0, .7, 5.2); inner.add(batt);
  const ssdMat = std(0x203a2e, .3, .5, { emissive: FOX, emissiveIntensity: 0 });
  const ssd = box(2.2, .16, 7.6, ssdMat); ssd.position.set(7.5, .62, -4.3); inner.add(ssd);
  const ssdChip = box(1.5, .1, 2, M.chip); ssdChip.position.y = .12; ssd.add(ssdChip);
  const lines = outline(W, Dp, 1.2, T, M.line); lines.rotation.x = -Math.PI / 2; lines.position.y = T / 2; model.add(lines);
  const dst = dust(model, 70);

  /* kawa na klawiaturze */
  const coffee = std(0x5a3a22, .1, .15, { transparent: true, opacity: .9 });
  const cDrops = Array.from({ length: 6 }, () => { const d = new THREE.Mesh(new THREE.SphereGeometry(.32, 16, 12), coffee); d.scale.y = 1.4; d.visible = false; model.add(d); return d; });
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 40), std(0x4a2f1b, .1, .08, { transparent: true, opacity: .85 })); puddle.rotation.x = -Math.PI / 2; puddle.position.set(-2, T + .26, -4.2); puddle.visible = false; model.add(puddle);
  const root = new THREE.Group(); root.add(model);
  const cr = makeCracks(scr.c.width * .66, scr.c.height * .35, scr.c.width * .7, 11);
  let lidA = Math.PI / 2 - .02, lidT = -.32, fanV = 0;
  const OPEN = -.32;

  const dev = {
    root, model, scr, shell: [M.alu, M.dark, keyMat, pad.material, M.ink], lines, inner, rest: [.38, -.42],
    enter() { lidA = Math.PI / 2 - .02; lidT = OPEN; },
    tick(dt, t, id) {
      if (id !== 'zawiasy') lidT = OPEN;
      lidA = damp(lidA, lidT, 4, dt); pivot.rotation.x = lidA;
      fanV = damp(fanV, id === 'chlodzenie' ? 30 : (inner.visible ? 4 : 0), 2, dt); fn.userData.blades.rotation.z += fanV * dt;
    },
    draw(t, id, p) {
      const x = scr.x, w = scr.c.width, h = scr.c.height;
      const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1d1e22'); g.addColorStop(1, '#0b0b0d'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      const rg = x.createRadialGradient(w * .5, h * .55, 0, w * .5, h * .55, w * .5); rg.addColorStop(0, 'rgba(226,83,30,.25)'); rg.addColorStop(1, 'rgba(226,83,30,0)'); x.fillStyle = rg; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, 0, w, h * .045);
      x.fillStyle = '#fff'; x.font = `600 ${h * .026}px Geist,sans-serif`; x.textAlign = 'left'; x.fillText('FoxFix', w * .02, h * .032); x.textAlign = 'right'; x.fillText(clockStr(), w * .98, h * .032);
      drawFox(x, w / 2, h * .48, h * .36, '#E2531E');
      x.fillStyle = 'rgba(255,255,255,.1)'; const dw = w * .42; x.beginPath(); x.roundRect(w / 2 - dw / 2, h * .88, dw, h * .085, h * .03); x.fill();
      for (let i = 0; i < 7; i++) { x.fillStyle = i === 3 ? '#E2531E' : 'rgba(255,255,255,.35)'; x.beginPath(); x.roundRect(w / 2 - dw / 2 + dw * .04 + i * dw * .135, h * .897, h * .055, h * .055, h * .014); x.fill(); }
      x.textAlign = 'center'; x.fillStyle = '#fff';
      if (id === 'matryca') { drawCracks(x, cr, p, w); x.globalAlpha = .55; ['#ff3b6b', '#3bd1ff', '#7dff6b'].forEach((c, i) => { x.fillStyle = c; x.fillRect(w * (.18 + i * .013), 0, w * .006, h); }); x.globalAlpha = 1; }
      else if (id === 'klawiatura') { x.fillStyle = 'rgba(8,8,10,.8)'; x.fillRect(w * .2, h * .3, w * .6, h * .3); x.fillStyle = '#fff'; x.font = `400 ${h * .05}px "Geist Mono",monospace`; const s = 'u nas dzia_a'; const n = Math.min(s.length, (p * 6) | 0); x.fillText(s.slice(0, n) + (Math.sin(t * 6) > 0 ? '▍' : ' '), w / 2, h * .45); x.fillStyle = '#F27A45'; x.font = `700 ${h * .032}px "Geist Mono",monospace`; x.fillText('brak litery „ł”', w / 2, h * .54); }
      else if (id === 'chlodzenie') { x.fillStyle = 'rgba(8,8,10,.82)'; x.fillRect(0, 0, w, h); const v = Math.round(lerp(94, 58, ease(Math.min(p / 3, 1)))); x.font = `700 ${h * .2}px Geist,sans-serif`; x.fillStyle = v > 75 ? '#F27A45' : '#7BD389'; x.fillText(`${v}°C`, w / 2, h * .55); x.fillStyle = '#fff'; x.font = `400 ${h * .035}px "Geist Mono",monospace`; x.fillText('CPU · po czyszczeniu i nowej paście', w / 2, h * .66); }
      else if (id === 'zasilanie') drawBattery(x, w, h, .04, t, true);
      else if (id === 'upgrade') drawProgress(x, w, h, p, t, 'Kopiuję dane na SSD…');
      else if (id === 'system') drawProgress(x, w, h, p, t, 'Instaluję Windows…');
      else if (id === 'dane') drawProgress(x, w, h, p, t, 'Odzyskuję pliki…');
      else if (id === 'bateria') drawBattery(x, w, h, Math.max(.03, .4 - p * .15), t, false);
      else if (id === 'zalanie') { x.fillStyle = 'rgba(8,8,10,.55)'; x.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(${200 + i * 9},${60 + i * 20},${120 - i * 10},.35)`; x.fillRect(0, (t * 120 + i * h / 6) % h, w, h * .015); } }
      scr.flush();
    },
    issues: {
      matryca: { rot: [.18, -.18], zoom: 1.15, focus: [0, 10, -10], anchor: [6, 16, -9.5], normal: [0, 0, 1] },
      klawiatura: {
        rot: [.8, -.12], zoom: 1.2, focus: [0, T, -3.6], anchor: [-6, T + .3, -3.5], normal: [0, 1, 0],
        update(dt, t) {
          keyBase.forEach(([x, y, z, sx], i) => { const w = Math.max(0, Math.sin(t * 5 - x * .35 - z * .2)); const hot = w > .85;
            dummy.position.set(x, y - (hot ? .1 : 0), z); dummy.scale.set(sx, 1, 1); dummy.updateMatrix(); keys.setMatrixAt(i, dummy.matrix); keys.setColorAt(i, hot ? cHot : cKey); });
          keys.instanceMatrix.needsUpdate = true; keys.instanceColor.needsUpdate = true;
        },
        exit() { keyBase.forEach(([x, y, z, sx], i) => { dummy.position.set(x, y, z); dummy.scale.set(sx, 1, 1); dummy.updateMatrix(); keys.setMatrixAt(i, dummy.matrix); keys.setColorAt(i, cKey); }); keys.instanceMatrix.needsUpdate = true; keys.instanceColor.needsUpdate = true; }
      },
      zawiasy: {
        rot: [.32, -.78], zoom: 1.2, anchor: [-11, T, -Dp / 2 + .45], normal: [-.5, .3, -1],
        update(dt, t) { lidT = OPEN + Math.sin(t * 2.2) * .38; pivot.rotation.z = Math.sin(t * 2.2 + 1) * .025; }, exit() { pivot.rotation.z = 0; }
      },
      chlodzenie: {
        rot: [.55, .55], zoom: 1.2, xray: 1, anchor: [-8.5, 1.2, -6.3], normal: [0, 1, 0],
        update(dt, t) { dst.on(t, new THREE.Vector3(-8, .7, -Dp / 2), new THREE.Vector3(0, .15, -1), .8, 9); }, exit() { dst.off(); }
      },
      zasilanie: {
        rot: [.3, 1.05], zoom: 1.45, focus: [-W / 2 + 4, T * .5, -4.2], anchor: [-W / 2, T * .5, -4.2], normal: [-1, 0, 0],
        update(dt, t) { plug.visible = true; const c = (Math.sin(t * 2.2) + 1) / 2, o = c > .45 ? 0 : (.45 - c) * 5; plug.position.set(-W / 2 - .3 - o, T * .5, -4.2); plug.rotation.y = c > .45 ? Math.sin(t * 9) * .08 : 0; const s = c > .45 && Math.sin(t * 21) > .3 ? 1 : 0; portMat.emissiveIntensity = s * 2; portLight.intensity = s * 40; },
        exit() { plug.visible = false; portMat.emissiveIntensity = 0; portLight.intensity = 0; }
      },
      upgrade: {
        rot: [.75, -.32], zoom: 1.35, xray: 1, focus: [5, 0, -2], anchor: [7.5, .8, -4.3], normal: [0, 1, 0],
        update(dt, t) { const c = (t * .5) % 1, k = ease(Math.min(c / .5, 1)); ssd.position.z = -4.3 + (1 - k) * 9; ssdMat.emissiveIntensity = k * (c < .9 ? .9 : 0); }, exit() { ssd.position.z = -4.3; ssdMat.emissiveIntensity = 0; }
      },
      bateria: {
        rot: [.62, -.28], zoom: 1.2, xray: 1, focus: [0, .7, 3], anchor: [4, .9, 5.2], normal: [0, 1, 0],
        update(dt, t, p) { const k = Math.min(p / 2, 1); M.bat.color.setRGB(lerp(.62, .89, k), lerp(.64, .33, k), lerp(.66, .12, k)); batt.scale.z = 1 + Math.max(0, Math.sin(t * 2.4)) * 1.4 * k; },
        exit() { M.bat.color.set(0x9da2a8); batt.scale.z = 1; }
      },
      zalanie: {
        rot: [.78, -.12], zoom: 1.25, focus: [0, T, -3.6], anchor: [-2, T + .4, -4.2], normal: [0, 1, 0],
        update(dt, t, p) {
          cDrops.forEach((d, i) => { const k = (t * .7 + i / cDrops.length) % 1; d.visible = true; d.position.set(-2 + Math.sin(i * 2.1) * 1.2, T + 9 - k * 8.6, -4.2 + Math.cos(i * 1.7) * .8); d.material.opacity = .9 * Math.min(1, (1 - k) * 4); });
          puddle.visible = true; const r = 1 + ease(Math.min(p / 3, 1)) * 2.6; puddle.scale.set(r, r * .8, 1);
        },
        exit() { cDrops.forEach(d => d.visible = false); puddle.visible = false; }
      },
      dane: {
        rot: [.7, -.2], zoom: 1.3, xray: 1, focus: [5, 0, -2], anchor: [7.5, .8, -4.3], normal: [0, 1, 0],
        update(dt, t) { ssdMat.emissiveIntensity = .6 + Math.sin(t * 7) * .4; }, exit() { ssdMat.emissiveIntensity = 0; }
      },
      system: { rot: [.2, .1], zoom: 1.05, anchor: [-7, 13, -9.8], normal: [0, 0, 1] },
    },
  };
  return dev;
}

function pc() {
  /* Nowoczesna obudowa: jasne aluminium, szklany bok, AIO z wentylatorami, karta z osłoną. */
  const M = mats(); const W = 9.6, H = 20.5, Dz = 19.5;
  const model = new THREE.Group();
  const caseMat = std(0xe7e8ea, .35, .42), caseDark = std(0x17181b, .4, .5), inMat = std(0x30333a, .35, .55);
  const add = (m, x, y, z, p = model) => { m.position.set(x, y, z); p.add(m); return m; };
  /* rama: prawy bok, góra, dół, tył jako zaokrąglone płyty */
  const side = slab(Dz, H, .35, .7, caseMat, .12); side.rotation.y = Math.PI / 2; add(side, W / 2 - .18, 0, 0);
  const top = slab(W, Dz, .35, .5, caseMat, .12); top.rotation.x = Math.PI / 2; add(top, 0, H / 2 - .18, 0);
  const bot = slab(W, Dz, .35, .5, caseMat, .12); bot.rotation.x = Math.PI / 2; add(bot, 0, -H / 2 + .18, 0);
  add(box(W - .3, H - .6, .25, caseDark), 0, 0, -Dz / 2 + .13);
  /* front z siateczką (tekstura z otworami) */
  const mc = document.createElement('canvas'); mc.width = mc.height = 256; const mx = mc.getContext('2d');
  mx.fillStyle = '#dcdde0'; mx.fillRect(0, 0, 256, 256); mx.fillStyle = '#2a2c30';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { mx.beginPath(); mx.arc(8 + x * 16 + (y % 2) * 8, 8 + y * 16, 4.2, 0, TAU); mx.fill(); }
  const mt = new THREE.CanvasTexture(mc); mt.wrapS = mt.wrapT = THREE.RepeatWrapping; mt.repeat.set(3, 6.4); mt.colorSpace = THREE.SRGBColorSpace;
  const front = slab(W + .05, H + .05, .55, .7, caseMat, .2); add(front, 0, 0, Dz / 2 - .1);
  const mesh = rrPlane(W - 1.3, H - 3.2, .4, std(0xffffff, .2, .7, { map: mt })); add(mesh, 0, -.6, Dz / 2 + .19);
  const ledMat = std(FOX, 0, .4, { emissive: FOX, emissiveIntensity: 1 });
  const strip = add(box(.16, H - 3.6, .05, ledMat), -W / 2 + .45, -.6, Dz / 2 + .2);
  const pwrMat = std(0x222222, 0, .4, { emissive: 0xffffff, emissiveIntensity: .9 });
  const pwr = cyl(.42, .12, std(0xc9cbcf, .85, .3)); pwr.rotation.x = Math.PI / 2; add(pwr, 0, H / 2 - 1.05, Dz / 2 + .2);
  const pwrRing = new THREE.Mesh(new THREE.TorusGeometry(.48, .05, 8, 32), pwrMat); add(pwrRing, 0, H / 2 - 1.05, Dz / 2 + .23);
  for (const [x, z] of [[-3.3, -7], [3.3, -7], [-3.3, 7], [3.3, 7]]) { const f = slab(1.6, .9, .5, .4, caseDark, .12); f.rotation.x = Math.PI / 2; add(f, x, -H / 2 - .25, z); }
  /* szkło z ciemną ramką */
  const glassMat = std(0x2b3440, .1, .04, { transparent: true, opacity: .16, depthWrite: false });
  const glass = slab(Dz - .2, H - .4, .1, .6, glassMat, .03); glass.rotation.y = Math.PI / 2; add(glass, -W / 2 + .1, 0, 0);
  const gl = outline(Dz - .5, H - .7, .5, .12, new THREE.LineBasicMaterial({ color: 0x3a3d42 })); gl.rotation.y = Math.PI / 2; add(gl, -W / 2 + .1, 0, 0);
  /* wnętrze */
  add(box(.12, 15.5, 14.5, inMat), W / 2 - .5, 1.6, -1.5);
  const hsMat = std(0x8d9096, .85, .3);
  add(box(.7, 1.4, 4.2, hsMat), W / 2 - .9, 7.6, -1.6); add(box(.7, 4.2, 1.2, hsMat), W / 2 - .9, 4.6, -4.4);
  add(box(.5, 3.2, 3.2, std(0x22252a, .5, .4)), W / 2 - .8, -.6, 2.2);
  for (let i = 0; i < 3; i++) add(box(.25, .9, 1.4, std(0x1a1c20, .4, .4)), W / 2 - .7, 1.0, -4.6 + i * 1.8);
  const shroud = add(box(W - .9, 3.6, Dz - 1.2, caseMat), -.2, -H / 2 + 2.2, 0);
  const psuWin = rrPlane(5.5, 1.2, .3, std(0x0b0b0d, .2, .3)); psuWin.rotation.y = -Math.PI / 2; add(psuWin, -W / 2 + .5, -H / 2 + 2.3, -4);
  const psuMat = std(FOX, 0, .4, { emissive: FOX, emissiveIntensity: 0 });
  const psuLbl = rrPlane(5.1, .26, .1, psuMat); psuLbl.rotation.y = -Math.PI / 2; add(psuLbl, -W / 2 + .49, -H / 2 + 2.3, -4);
  const bladeMat = std(0x2e3034, .3, .5), fanFrame = std(0x1b1c1f, .3, .5);
  const fans = [];
  /* AIO: blok pompy z lisem + chłodnica pod sufitem z dwoma wentylatorami */
  const pump = cyl(1.6, .7, std(0x16171a, .5, .35)); pump.rotation.z = Math.PI / 2; add(pump, W / 2 - 1, 4.6, -1.6);
  /* ekran LCD na pompie: pokazuje stan naprawy (temperatura, postęp, odzysk) */
  const pc2 = document.createElement('canvas'); pc2.width = pc2.height = 384; const px = pc2.getContext('2d');
  const lcdTex = new THREE.CanvasTexture(pc2); lcdTex.colorSpace = THREE.SRGBColorSpace;
  const lcdMat = new THREE.MeshBasicMaterial({ map: lcdTex }); lcdMat.toneMapped = false;
  const pumpFace = new THREE.Mesh(new THREE.CircleGeometry(1.45, 48), lcdMat);
  const ring = (frac, col, w = 26) => { px.lineCap = 'round'; px.lineWidth = w; px.strokeStyle = 'rgba(255,255,255,.1)'; px.beginPath(); px.arc(192, 192, 150, 0, TAU); px.stroke(); px.strokeStyle = col; px.beginPath(); px.arc(192, 192, 150, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(.001, frac)); px.stroke(); };
  const txt = (t, y, size, col = '#fff', wgt = 700) => { px.fillStyle = col; px.textAlign = 'center'; px.textBaseline = 'middle'; px.font = `${wgt} ${size}px "Geist Mono",monospace`; px.fillText(t, 192, y); };
  let lcdKey = '';
  function lcd(id, t, c) {
    const key = id + ':' + Math.floor(t * 12); if (key === lcdKey) return; lcdKey = key;
    px.fillStyle = '#0c0d0f'; px.fillRect(0, 0, 384, 384);
    if (id === 'czyszczenie') { const k = ease(Math.min(c / .8, 1)), temp = Math.round(94 - k * 56), col = `hsl(${12 + k * 175},85%,58%)`; ring(1 - k * .6, col); txt(temp + '°C', 182, 92, col); txt('CPU', 250, 34, '#9b9ba4', 500); }
    else if (id === 'system') { const v = Math.floor(Math.min(c / .9, 1) * 100); ring(v / 100, '#E2531E'); txt(v + '%', 178, 84); txt('Windows', 250, 32, '#9b9ba4', 500); }
    else if (id === 'dane') { const v = Math.floor(Math.min(c / .9, 1) * 100); ring(v / 100, '#4CC27A'); txt(Math.round(v * 12.47) + '', 170, 80); txt('plików', 240, 32, '#9b9ba4', 500); }
    else if (id === 'upgrade') { const k = Math.min(c / .55, 1); ring(k, '#E2531E'); txt(k < 1 ? '16 GB' : '32 GB', 182, 70); txt('RAM', 250, 32, '#9b9ba4', 500); }
    else if (id === 'gpu') { const k = ease(Math.min(c / .5, 1)), fps = Math.round(24 + k * 120); ring(k, '#E2531E'); txt(fps + '', 178, 84); txt('FPS', 250, 32, '#9b9ba4', 500); }
    else if (id === 'zasilacz') { if (Math.sin(t * 9) > 0) { txt('!', 192, 170, '#E2531E'); } }
    else drawFox(px, 192, 192, 210, '#E2531E', 12);
    lcdTex.needsUpdate = true;
  }
  lcd('', 0, 0);
  pumpFace.rotation.y = -Math.PI / 2; add(pumpFace, W / 2 - 1.36, 4.6, -1.6);
  const tube = (z) => { const t = cyl(.18, 3.4, caseDark, 12); add(t, W / 2 - 1.2, 6.9, z); };
  tube(-2.1); tube(-1.1);
  add(box(2.2, .9, 12, std(0x2a2c30, .6, .4)), .2, H / 2 - 1, -1.2);
  for (const z of [-4.2, 1.8]) { const f = fan(2.4, fanFrame, bladeMat); f.rotation.x = Math.PI / 2; add(f, .2, H / 2 - 1.5, z); fans.push(f); }
  /* RAM */
  const ramMat = std(0xd9dadd, .6, .35), ramTop = std(FOX, .2, .4, { emissive: FOX, emissiveIntensity: .4 });
  const rams = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group(); g.position.set(W / 2 - 1.25, 4.3, .4 + i * .5);
    g.add(box(1.5, 5.6, .14, ramMat)); const tp = box(.18, 5.6, .16, ramTop); tp.position.x = -.78; g.add(tp);
    model.add(g); rams.push(g); if (i % 2) g.visible = false;
  }
  /* karta graficzna */
  const gpu = new THREE.Group(); gpu.position.set(1.3, -3.1, -.8); model.add(gpu);
  const gMat = std(0x2b2e34, .6, .35, { emissive: FOX, emissiveIntensity: 0 });
  const gBody = slab(12.5, 2.2, 5.4, .5, gMat, .15); gBody.rotation.y = Math.PI / 2; gpu.add(gBody);
  const gStripe = box(.05, .3, 11, std(FOX, 0, .4, { emissive: FOX, emissiveIntensity: 1.1 })); gStripe.position.set(-2.72, .62, 0); gpu.add(gStripe);
  const gPlate = box(.05, .9, 11.6, std(0xc9cbcf, .85, .3)); gPlate.position.set(-2.72, -.25, 0); gpu.add(gPlate);
  
  for (const z of [-3.7, 0, 3.7]) { const f = fan(1.6, fanFrame, bladeMat); f.rotation.x = Math.PI / 2; f.position.set(0, -1.13, z); gpu.add(f); fans.push(f); }
  /* wentylatory na tyle */
  const rear = fan(2.1, fanFrame, bladeMat); add(rear, .3, 4.4, -Dz / 2 + .45); fans.push(rear);
  /* dysk SSD M.2 na płycie głównej (z radiatorem i diodą aktywności) */
  const ssd = new THREE.Group(); ssd.position.set(W / 2 - .66, -.85, -3.0); model.add(ssd);
  ssd.add(box(.1, .95, 4.6, std(0x1d2a22, .3, .6)));
  const ssdHs = box(.28, .82, 4.2, std(0x26282d, .7, .35)); ssdHs.position.x = -.18; ssd.add(ssdHs);
  const ssdStripe = box(.04, .14, 3.6, std(FOX, .1, .4, { emissive: FOX, emissiveIntensity: .5 })); ssdStripe.position.set(-.33, .18, 0); ssd.add(ssdStripe);
  const ssdLedMat = std(0x4CC27A, 0, .4, { emissive: 0x4CC27A, emissiveIntensity: 0 });
  const ssdLed = box(.06, .12, .2, ssdLedMat); ssdLed.position.set(-.33, -.22, 1.9); ssd.add(ssdLed);
  /* odzyskiwane pliki: małe kartki wylatujące z dysku przez szybę */
  const fc = document.createElement('canvas'); fc.width = 64; fc.height = 80; const fx = fc.getContext('2d');
  fx.fillStyle = '#fff'; fx.beginPath(); fx.moveTo(4, 4); fx.lineTo(44, 4); fx.lineTo(60, 20); fx.lineTo(60, 76); fx.lineTo(4, 76); fx.closePath(); fx.fill();
  fx.fillStyle = '#E2531E'; fx.beginPath(); fx.moveTo(44, 4); fx.lineTo(60, 20); fx.lineTo(44, 20); fx.closePath(); fx.fill();
  fx.fillStyle = '#c9cbd0'; for (let i = 0; i < 4; i++) fx.fillRect(12, 32 + i * 10, i === 3 ? 26 : 40, 4);
  const fileTex = new THREE.CanvasTexture(fc); fileTex.colorSpace = THREE.SRGBColorSpace;
  const files = []; const fileGeo = new THREE.PlaneGeometry(.8, 1);
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(fileGeo, new THREE.MeshBasicMaterial({ map: fileTex, transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; m.userData.s = i / 14; m.userData.r = Math.random(); model.add(m); files.push(m); }
  const dst = dust(model, 90);
  const lines = new THREE.Group(); model.add(lines);
  const root = new THREE.Group(); root.add(model);
  let speed = 2, cyc = 0, lastId = null;
  return {
    root, model, shell: [], lines, inner: null, rest: [.1, .92],
    tick(dt, t, id) {
      speed = damp(speed, id === 'czyszczenie' || id === 'gpu' ? 26 : (id === 'zasilacz' ? (Math.sin(t * 9) > 0 ? 0 : 6) : 3), 3, dt);
      fans.forEach(f => f.userData.blades.rotation.z += speed * dt);
      pwrMat.emissiveIntensity = id === 'system' ? (Math.sin(t * 8) > 0 ? 2 : 0) : (id === 'zasilacz' ? 0 : .9);
      if (id !== lastId) { lastId = id; cyc = 0; } cyc += dt / 4.5; const c = cyc % 1;
      lcd(id || '', t, c);
      ssdLedMat.emissiveIntensity = id === 'dane' || id === 'system' ? (Math.sin(t * 31) > .2 ? 2.2 : .1) : .25;
      ledMat.color.setHex(FOX); ledMat.emissive.setHex(FOX);
      if (id === 'czyszczenie') { const k = ease(Math.min(c / .8, 1)); ledMat.emissive.setHSL((12 + k * 175) / 360, .85, .55); }
      ledMat.emissiveIntensity = id === 'dane' ? 1 : id === 'system' ? 1.2 + Math.sin(t * 4) : (id === 'zasilacz' ? (Math.sin(t * 17) > .6 ? .8 : 0) : 1);
    },
    issues: {
      czyszczenie: {
        rot: [.18, 1.0], zoom: 1.75, focus: [1.5, 5.6, -1], anchor: [-1.4, H / 2 - 1.7, 3.2], normal: [-1, -.3, 0],
        update(dt, t) { dst.on(t, new THREE.Vector3(.2, H / 2 - 2, -1), new THREE.Vector3(-1, -.1, .4), 1.4, 9); }, exit() { dst.off(); }
      },
      upgrade: {
        rot: [.2, .95], zoom: 1.8, focus: [W / 2 - 1.25, 4.3, 2.2], anchor: [W / 2 - 1.25, 7.2, 2.2], normal: [-1, .4, 0],
        update(dt, t) { const c = (t * .5) % 1, k = ease(Math.min(c / .55, 1)); rams.forEach((r, i) => { if (i % 2) { r.visible = true; r.position.y = 4.3 + (1 - k) * 9; } }); ramTop.emissiveIntensity = .4 + Math.sin(t * 6) * .3; },
        exit() { rams.forEach((r, i) => { if (i % 2) r.visible = false; }); ramTop.emissiveIntensity = .4; }
      },
      gpu: {
        rot: [-.38, .9], zoom: 1.4, focus: [1.3, -3.1, -.8], anchor: [-1.4, -3.1, -.8], normal: [-1, -.3, 0],
        update(dt, t) { const c = (t * .4) % 1, k = ease(Math.min(c / .5, 1)); gpu.position.x = 1.3 - (1 - k) * 9; gMat.emissiveIntensity = (1 - k) * .3; }, exit() { gpu.position.x = 1.3; gMat.emissiveIntensity = 0; }
      },
      zasilacz: {
        rot: [-.05, .8], zoom: 1.55, focus: [-W / 2 + .5, -H / 2 + 2.3, -4], anchor: [-W / 2 + .5, -H / 2 + 2.3, -4], normal: [-1, 0, 0],
        update(dt, t) { psuMat.emissiveIntensity = Math.random() > .75 ? 2 : 0; }, exit() { psuMat.emissiveIntensity = 0; }
      },
      dane: {
        rot: [.06, 1.05], zoom: 1.6, focus: [W / 2 - 1.6, .6, -3], anchor: [W / 2 - 1.05, -.85, -3], normal: [-1, 0, 0],
        update(dt, t) {
          ssdStripe.material.emissiveIntensity = .6 + Math.sin(t * 8) * .4;
          files.forEach(f => { const k = (t * .32 + f.userData.s) % 1, r = f.userData.r; f.visible = true;
            f.position.set(W / 2 - 1.1 - k * 9, -.85 + Math.sin(k * Math.PI) * (2 + r * 3) + k * 2.5, -3 + (r - .5) * 5 * k);
            f.rotation.set(0, -Math.PI / 2 + Math.sin(t + r * 6) * .5, Math.sin(t * 2 + r * 9) * .3);
            f.scale.setScalar(.4 + ease(Math.min(k * 3, 1)) * .8); f.material.opacity = k < .1 ? k * 10 : (k > .8 ? (1 - k) * 5 : 1); });
        },
        exit() { files.forEach(f => f.visible = false); ssdStripe.material.emissiveIntensity = .5; }
      },
      system: { rot: [.1, 1.02], zoom: 2.1, focus: [W / 2 - 1.36, 4.6, -1.6], anchor: [W / 2 - 1.4, 4.6 + 1.85, -1.6], normal: [-1, .3, 0] },
    },
  };
}

function watch() {
  const M = mats(); const W = 4.1, H = 4.8, D = 1.15;
  const model = new THREE.Group();
  const body = slab(W, H, D, 1.15, M.frame, .3); model.add(body);
  const scr = new Screen(3.6, 4.3, 768);
  const sm = rrPlane(3.6, 4.3, .9, scr.mat); sm.position.z = D / 2 + .004; model.add(sm);
  const crown = new THREE.Group(); crown.position.set(W / 2 + .12, .85, 0); model.add(crown);
  const crw = cyl(.36, .36, M.frame, 36); crw.rotation.z = Math.PI / 2; crown.add(crw);
  const knurl = []; for (let i = 0; i < 18; i++) { const k = box(.3, .04, .04, M.back); const a = i / 18 * TAU; k.position.set(0, Math.cos(a) * .37, Math.sin(a) * .37); k.rotation.x = -a; crown.add(k); knurl.push(k); }
  const crownMat = std(FOX, .1, .4, { emissive: FOX, emissiveIntensity: .2 });
  const cdot = new THREE.Mesh(new THREE.CircleGeometry(.22, 24), crownMat); cdot.rotation.y = Math.PI / 2; cdot.position.x = .185; crown.add(cdot);
  const side = new THREE.Mesh(new THREE.CapsuleGeometry(.13, .7, 4, 12), M.frame); side.position.set(W / 2 + .02, -.75, 0); side.scale.set(1, 1, 1.2); model.add(side);
  const sensor = new THREE.Mesh(new THREE.SphereGeometry(1.45, 40, 20), M.back); sensor.scale.z = .22; sensor.position.z = -D / 2 + .05; model.add(sensor);
  const ledMat = std(0x2bd46a, 0, .4, { emissive: 0x2bd46a, emissiveIntensity: 0 });
  const leds = []; for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CircleGeometry(.14, 16), ledMat); const a = i / 4 * TAU + .78; l.position.set(Math.cos(a) * .5, Math.sin(a) * .5, -D / 2 - .27); l.rotation.y = Math.PI; model.add(l); leds.push(l); }
  const strapMat = std(0x1c1d20, .05, .85), strapO = std(FOX, .05, .7);
  const mk = (mat, dir) => { const s = strap(2.9, 6.8, .34, 3.4, mat, dir); s.position.set(0, dir * (H / 2 - .45), -.1); return s; };
  const sA = [mk(strapMat, 1), mk(strapMat, -1)], sB = [mk(strapO, 1), mk(strapO, -1)];
  [...sA, ...sB].forEach(s => model.add(s)); sB.forEach(s => s.visible = false);
  const inner = new THREE.Group(); inner.visible = false; model.add(inner);
  const batMat = M.bat; const bat = cyl(1.35, .35, batMat); bat.rotation.x = Math.PI / 2; bat.position.z = -.1; inner.add(bat);
  const brd = slab(3.2, 3.8, .08, .7, M.board, .02); brd.position.z = .25; inner.add(brd);
  const lines = outline(W, H, 1.15, D, M.line); model.add(lines);
  const root = new THREE.Group(); root.add(model);
  const cr = makeCracks(scr.c.width * .64, scr.c.height * .32, scr.c.width * .9, 5);
  let crownV = 0;
  return {
    root, model, scr, shell: [M.frame, M.back, scr.mat], lines, inner, rest: [.18, -.42],
    tick(dt, t, id) { crownV = damp(crownV, id === 'koronka' ? 6 : 0, 3, dt); crown.rotation.x += crownV * dt; crownMat.emissiveIntensity = id === 'koronka' ? 1 + Math.sin(t * 6) * .6 : .2; ledMat.emissiveIntensity = id === 'czujniki' ? (Math.sin(t * 9) > 0 ? 2.2 : .2) : 0; },
    draw(t, id, p) {
      const x = scr.x, w = scr.c.width, h = scr.c.height;
      x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
      const cx = w / 2;
      x.lineCap = 'round';
      [[w * .36, '#E2531E', .72], [w * .3, '#ffffff', .5], [w * .24, '#7BD389', .86]].forEach(([r, c, v]) => {
        x.lineWidth = w * .045; x.strokeStyle = c + '33'; x.beginPath(); x.arc(cx, h * .6, r, 0, TAU); x.stroke();
        x.strokeStyle = c; x.beginPath(); x.arc(cx, h * .6, r, -Math.PI / 2, -Math.PI / 2 + TAU * v); x.stroke();
      });
      drawFox(x, cx, h * .6, w * .22, '#E2531E', 9);
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = `700 ${w * .2}px Geist,sans-serif`; x.fillText(clockStr(), cx, h * .2);
      x.font = `400 ${w * .06}px "Geist Mono",monospace`; x.globalAlpha = .6; x.fillText(dateStr(), cx, h * .27); x.globalAlpha = 1;
      if (id === 'ekran') drawCracks(x, cr, p, w * 1.5);
      else if (id === 'bateria') drawBattery(x, w, h, Math.max(.02, .3 - p * .1), t, false);
      else if (id === 'oprogramowanie') drawProgress(x, w, h, p, t, 'Parowanie…');
      else if (id === 'czujniki') { x.fillStyle = 'rgba(0,0,0,.85)'; x.fillRect(0, 0, w, h); const beat = Math.max(0, Math.sin(t * 7)); x.fillStyle = '#E2531E'; x.font = `700 ${w * (.22 + beat * .03)}px Geist,sans-serif`; x.fillText('♥', cx, h * .45); x.fillStyle = '#fff'; x.font = `700 ${w * .16}px "Geist Mono",monospace`; x.fillText(p < 1.5 ? '-- bpm' : '72 bpm', cx, h * .68); }
      else if (id === 'koronka') { x.fillStyle = 'rgba(0,0,0,.9)'; x.fillRect(0, 0, w, h); const off = (t * 60) % (h * .18); x.font = `600 ${w * .08}px Geist,sans-serif`; ['Tętno', 'Kroki', 'Minutnik', 'Pogoda', 'Muzyka', 'Budzik', 'Kompas'].forEach((s, i) => { const y = h * .2 + i * h * .18 - off; x.globalAlpha = Math.max(0, 1 - Math.abs(y - h / 2) / (h * .5)); x.fillStyle = '#fff'; x.textAlign = 'left'; x.fillText(s, w * .18, y); x.fillStyle = '#E2531E'; x.beginPath(); x.arc(w * .1, y - w * .025, w * .025, 0, TAU); x.fill(); }); x.globalAlpha = 1; x.textAlign = 'center'; }
      scr.flush();
    },
    issues: {
      ekran: { rot: [.05, -.24], zoom: 1.35, anchor: [.5, .7, D / 2], normal: [0, 0, 1] },
      bateria: { rot: [.12, Math.PI - .42], zoom: 1.25, xray: 1, anchor: [0, 0, -D / 2], normal: [0, 0, -1],
        update(dt, t, p) { const k = Math.min(p / 2, 1); batMat.color.setRGB(lerp(.62, .89, k), lerp(.64, .33, k), lerp(.66, .12, k)); bat.scale.y = 1 + Math.max(0, Math.sin(t * 2.4)) * .8 * k; }, exit() { batMat.color.set(0x9da2a8); bat.scale.y = 1; } },
      pasek: {
        rot: [.4, -.62], zoom: .95, anchor: [0, -H / 2 - 1.6, -.6], normal: [0, -.2, 1],
        update(dt, t) { const c = (t * .33) % 1, out = ease(Math.min(c / .4, 1)), inn = ease(Math.max(0, (c - .45) / .4));
          sA.forEach((s, i) => { const d = i ? -1 : 1; s.visible = out < 1; s.position.y = d * (H / 2 - .45 + out * 7); });
          sB.forEach((s, i) => { const d = i ? -1 : 1; s.visible = c > .45; s.position.y = d * (H / 2 - .45 + (1 - inn) * 7); });
        },
        exit() { sA.forEach((s, i) => { s.visible = true; s.position.y = (i ? -1 : 1) * (H / 2 - .45); }); sB.forEach(s => s.visible = false); }
      },
      koronka: { rot: [.12, -1.2], zoom: 2.2, focus: [W / 2, .85, 0], anchor: [W / 2 + .3, .85, 0], normal: [1, 0, 0] },
      oprogramowanie: { rot: [.02, .2], zoom: 1.3, anchor: [-.9, -.8, D / 2], normal: [0, 0, 1] },
    },
  };
}

/* ======================================================================
   STUDIO
   ====================================================================== */
function envMap(renderer) {
  const s = new THREE.Scene(), g = new THREE.BoxGeometry();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ color: 0x5a5a5a, side: THREE.BackSide })));
  const L = (x, y, z, sx, sy, sz, i) => { const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i) })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); s.add(m); };
  L(0, 5.8, 0, 7, .1, 7, 4); L(-5.8, 1.5, 0, .1, 3, 6, 2.2); L(5.8, 1, 2, .1, 3, 3, 1.6); L(0, 1, -5.8, 6, 3, .1, 1.3); L(0, 1, 5.8, 3, 2, .1, .9);
  const pm = new THREE.PMREMGenerator(renderer), t = pm.fromScene(s, .04).texture; pm.dispose(); return t;
}

export function createStudio({ stage, canvas, pinsEl, svgEl, callout, onPick, onHover, letters, still = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.environment = envMap(renderer);
  const camera = new THREE.PerspectiveCamera(26, 1, .1, 400);
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(6, 10, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe2d2, 1.1); rim.position.set(-8, 4, -6); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d4cc, .5));

  /* cień kontaktowy */
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const sx = sc.getContext('2d');
  const sg = sx.createRadialGradient(64, 64, 0, 64, 64, 64); sg.addColorStop(0, 'rgba(0,0,0,.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = sg; sx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);

  const builders = { telefon: () => handheld('phone'), tablet: () => handheld('tablet'), laptop, pc, zegarek: watch };
  const cache = {};
  let dev = null, devName = null, leaving = null, issue = null, issueT = 0, enterT = 1, xr = 0, dist = 40;
  let drag = { on: false, x: 0, y: 0, rx: 0, ry: 0 }, visible = true, raf = 0, last = performance.now(), t = 0;
  const v3 = new THREE.Vector3(), n3 = new THREE.Vector3(), q = new THREE.Quaternion(), camDir = new THREE.Vector3();

  function measure(d) {
    d.model.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(d.model), s = b.getBoundingSphere(new THREE.Sphere());
    d.radius = s.radius; d.dist = s.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.12;
    d.center = s.center.clone();
    /* zawartość przesunięta tak, by model obracał się wokół swojego środka */
    const content = new THREE.Group(); [...d.model.children].forEach(c => content.add(c)); content.position.copy(s.center).negate();
    d.model.add(content); d.content = content;
  }

  function setDevice(name) {
    if (name === devName) return;
    if (dev) { leaving = { d: dev, t: 0 }; if (issue && dev.issues[issue]?.exit) dev.issues[issue].exit(); }
    if (!cache[name]) {
      const d = builders[name]();
      scene.add(d.root); measure(d); cache[name] = d;
    } else scene.add(cache[name].root);
    dev = cache[name]; devName = name; issue = null; enterT = 0; xr = 0; setX(0);
    dev.model.rotation.set(dev.rest[0], dev.rest[1] - .9, 0);
    if (dev.enter) dev.enter();
    buildPins();
    callout.hidden = true;
  }
  function setX(k) {
    if (!dev) return;
    dev.shell.forEach(m => { const tr = k > .001; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = 1 - k * .88; m.depthWrite = k < .5; });
    if (dev.lines) dev.lines.children.forEach(l => l.material.opacity = k * .95);
    if (dev.inner) dev.inner.visible = k > .02;
  }
  function setIssue(id) {
    if (!dev) return;
    if (issue && dev.issues[issue]?.exit) dev.issues[issue].exit();
    issue = id && dev.issues[id] ? id : null; issueT = 0;
    pinsEl.querySelectorAll('.pin').forEach(p => p.classList.toggle('on', p.dataset.id === issue));
  }
  function buildPins() {
    pinsEl.innerHTML = '';
    Object.keys(dev.issues).forEach(id => {
      const b = document.createElement('button'); b.className = 'pin'; b.dataset.id = id; b.type = 'button';
      b.innerHTML = `<span>${letters(id)}</span>`; b.setAttribute('aria-label', letters(id, true));
      b.onclick = () => onPick(id);
      pinsEl.append(b);
    });
  }

  /* obracanie przeciąganiem */
  canvas.addEventListener('pointerdown', e => { drag.on = true; drag.x = e.clientX; drag.y = e.clientY; canvas.setPointerCapture(e.pointerId); stage.classList.add('grab'); });
  canvas.addEventListener('pointermove', e => { if (!drag.on) return; drag.ry += (e.clientX - drag.x) * .009; drag.rx += (e.clientY - drag.y) * .006; drag.rx = Math.max(-1, Math.min(1, drag.rx)); drag.x = e.clientX; drag.y = e.clientY; });
  const up = () => { drag.on = false; stage.classList.remove('grab'); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

  function resize() {
    const r = stage.getBoundingClientRect(); renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
    svgEl.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
  }
  new ResizeObserver(resize).observe(stage); resize();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }, { rootMargin: '100px' }).observe(stage);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });

  function frame(dt) {
    t += dt;
    if (leaving) { leaving.t += dt * 4; const k = ease(leaving.t); leaving.d.root.scale.setScalar(1 - k * .25); leaving.d.root.visible = k < 1; if (k >= 1) { scene.remove(leaving.d.root); leaving.d.root.scale.setScalar(1); leaving.d.root.visible = true; leaving = null; } }
    if (!dev) return;
    enterT = Math.min(1, enterT + dt * 1.4); issueT += dt;
    const I = issue && dev.issues[issue];
    const k = ease(enterT);
    dev.root.scale.setScalar(lerp(.82, 1, k));
    if (!drag.on) { drag.rx = damp(drag.rx, 0, 2.2, dt); drag.ry = damp(drag.ry, 0, 2.2, dt); }
    const tr = I ? I.rot : dev.rest, sway = I || still ? 0 : Math.sin(t * .5) * .12;
    const m = dev.model;
    m.rotation.x = damp(m.rotation.x, tr[0] + drag.rx, 3.2, dt);
    m.rotation.y = damp(m.rotation.y, tr[1] + sway + drag.ry, 3.2, dt);
    const zoom = I?.zoom || 1;
    dist = damp(dist, dev.dist / zoom, 3, dt);
    camera.position.set(0, dev.radius * .06, dist); camera.lookAt(0, 0, 0);
    /* centrowanie na punkcie usterki */
    const f = I?.focus;
    if (f) { v3.set(f[0], f[1], f[2]).sub(dev.center).applyEuler(m.rotation); } else v3.set(0, 0, 0);
    const bob = still ? 0 : Math.sin(t * 1.1) * dev.radius * .012;
    m.position.x = damp(m.position.x, -v3.x * .9, 3, dt);
    m.position.y = damp(m.position.y, -v3.y * .9 + bob, 3, dt);
    m.position.z = damp(m.position.z, -v3.z * .9, 3, dt);
    /* model obraca się wokół środka */
    xr = damp(xr, I?.xray ? 1 : 0, 4, dt); setX(xr);
    shadow.position.set(0, -dev.radius * .92, 0); shadow.scale.setScalar(dev.radius * 1.5 * (1 - bob * .02));
    shadow.material.opacity = .5;
    dev.tick?.(dt, t, issue);
    I?.update?.(dt, t, issueT);
    if (dev.draw) { dev.drawAcc = (dev.drawAcc || 0) + dt; const anim = issue && ['ekran', 'bateria', 'port', 'zalanie', 'oprogramowanie', 'matryca', 'klawiatura', 'chlodzenie', 'zasilanie', 'upgrade', 'system', 'dane', 'koronka'].includes(issue); if (anim || dev.drawAcc > 1 || dev.lastIssue !== issue) { dev.draw(t, issue, issueT); dev.drawAcc = 0; dev.lastIssue = issue; } }
  }
  function placePins() {
    const r = stage.getBoundingClientRect(); camera.getWorldDirection(camDir);
    dev.content.updateMatrixWorld();
    q.setFromRotationMatrix(dev.content.matrixWorld);
    let active = null;
    pinsEl.querySelectorAll('.pin').forEach(p => {
      const I = dev.issues[p.dataset.id];
      v3.set(...I.anchor).applyMatrix4(dev.content.matrixWorld);
      n3.set(...I.normal).normalize().applyQuaternion(q);
      const toCam = camera.position.clone().sub(v3).normalize();
      const vis = n3.dot(toCam) > .12 || xr > .5 || p.dataset.id === issue;
      const s = v3.clone().project(camera), x = (s.x + 1) / 2 * r.width, y = (1 - s.y) / 2 * r.height;
      p.style.transform = `translate(${x}px,${y}px)`; p.classList.toggle('hid', !vis || enterT < .6);
      if (p.dataset.id === issue) active = [x, y];
    });
    if (active && enterT > .8) {
      const [x, y] = active, right = x < r.width * .55, cw = callout.offsetWidth || 200, ch = callout.offsetHeight || 60;
      const cx = right ? r.width - cw - 18 : 18, cy = Math.max(18, Math.min(r.height - ch - 60, y - ch - 40));
      callout.hidden = false; callout.style.transform = `translate(${cx}px,${cy}px)`;
      const ax = right ? cx : cx + cw, ay = cy + ch / 2, ex = right ? ax - 28 : ax + 28;
      svgEl.innerHTML = `<polyline points="${x},${y} ${ex},${ay} ${ax},${ay}"/><circle cx="${x}" cy="${y}" r="3"/>`;
    } else { callout.hidden = true; svgEl.innerHTML = ''; }
  }
  function loop() {
    if (raf) return;
    const step = now => {
      raf = 0; if (!visible || document.hidden) return;
      const dt = Math.min(CAP, (now - last) / 1000); last = now;
      frame(dt); renderer.render(scene, camera); if (dev) placePins();
      raf = requestAnimationFrame(step);
    };
    last = performance.now(); raf = requestAnimationFrame(step);
  }
  loop();
  return { setDevice, setIssue, fill(c) { if (dev?.scr) dev.draw = () => { const x = dev.scr.x; x.fillStyle = c; x.fillRect(0, 0, dev.scr.c.width, dev.scr.c.height); dev.scr.flush(); }; }, pose(rx, ry, z) { if (dev) { dev.rest = [rx, ry]; if (z) dev.dist = dev.dist / z; } }, get issue() { return issue; }, debug() { return { rot: [dev.model.rotation.x, dev.model.rotation.y], issue, xr, dist }; } };
}
