import * as THREE from 'three';
import { solid, rng, PALETTE } from './toon.js?v=20261008151147';
import { person } from './characters.js?v=20261008151147';
import { insidePoly, nearestOnPoly, lampPost } from './island.js?v=20261008151147';


// La vie de l'île : plage et vagues, parc, arbres, immeubles, tour, entrepôts, supermarché et son parking.
// Coordonnées dans le repère de construction du port (déplacées d'un bloc avec lui).

const CAR_COLORS = ['#ff6a4d', '#4d7cff', '#ffc845', '#2f9e55', '#f6f1e7', '#a25dd9', '#9aa3ad'];

function pine(R, y) {
  const g = new THREE.Group();
  const h = 4 + R() * 3;
  g.add(solid(new THREE.CylinderGeometry(0.3, 0.4, 1.6, 5).translate(0, y + 0.8, 0), PALETTE.wood, { outlineWidth: 0.08 }));
  g.add(solid(new THREE.ConeGeometry(1.8 + R() * 0.6, h, 6).translate(0, y + 1.4 + h / 2, 0), R() > 0.5 ? '#4f8f4a' : PALETTE.grassDark, { outlineWidth: 0.1 }));
  return g;
}
function leafy(R, y) {
  const g = new THREE.Group();
  g.add(solid(new THREE.CylinderGeometry(0.35, 0.45, 2.6, 5).translate(0, y + 1.3, 0), PALETTE.wood, { outlineWidth: 0.08 }));
  g.add(solid(new THREE.IcosahedronGeometry(2.2 + R() * 1.2, 0).translate(0, y + 4.2, 0), R() > 0.5 ? '#5fa356' : '#79b85e', { outlineWidth: 0.1 }));
  return g;
}
function palm(R, y) {
  const g = new THREE.Group();
  const h = 6 + R() * 2;
  g.add(solid(new THREE.CylinderGeometry(0.25, 0.4, h, 5).rotateZ(0.12).translate(0.4, y + h / 2, 0), '#b08a5a', { outlineWidth: 0.06 }));
  for (let k = 0; k < 5; k++) {
    const leaf = solid(new THREE.BoxGeometry(0.5, 0.12, 3.2).translate(0, 0, 1.6), '#4f9a48', { outlineWidth: 0.04 });
    leaf.position.set(0.8, y + h, 0);
    leaf.rotation.set(0.45, (k / 5) * Math.PI * 2, 0);
    g.add(leaf);
  }
  return g;
}
function car(color) {
  const g = new THREE.Group();
  g.add(solid(new THREE.BoxGeometry(2.2, 1.0, 4.2).translate(0, 0.8, 0), color, { outlineWidth: 0.05 }));
  g.add(solid(new THREE.BoxGeometry(1.9, 0.9, 2.2).translate(0, 1.7, -0.2), '#bfe9f5', { outlineWidth: 0.04 }));
  g.scale.setScalar(1.6);
  return g;
}
function signTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 128);
  x.fillStyle = fg; x.font = 'bold 76px "Space Grotesk", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildIslandLife({ root, anim, blocks, circles, poly, top, S, hills = [] }) {
  const groundAt = (x, z) => {
    for (const hl of hills) { const k = Math.hypot(x - hl.x, z - hl.z) / hl.r; if (k < 1) return hl.y + hl.h * Math.sqrt(1 - k * k) - 0.4; }
    return top;
  };
  const R = rng(909);
  const life = new THREE.Group();
  root.add(life);
  const Y = top;
  const block = (x, z, hx, hz) => blocks.boxes.push({ x, z, hx, hz });

  // --- Plage au nord : sable qui descend dans l'eau, parasols, serviettes, baigneurs, vagues.
  const n = poly.pts.length;
  const beachIdx = [];
  for (let i = 0; i < n; i++) { const p = poly.pts[i]; if (p.y < -462 && p.x > 300 && p.x < 480) beachIdx.push(i); }
  beachIdx.sort((a, b) => poly.pts[a].x - poly.pts[b].x);
  const cx = poly.pts.reduce((s, p) => s + p.x, 0) / n, cz = poly.pts.reduce((s, p) => s + p.y, 0) / n;
  const beach = beachIdx.map((i) => {
    const p = poly.pts[i];
    const ox = p.x - cx, oz = p.y - cz, l = Math.hypot(ox, oz);
    return { x: p.x, z: p.y, ox: ox / l, oz: oz / l };
  });
  if (beach.length > 2) {
    const pos = [], idx = [];
    beach.forEach((b, i) => {
      pos.push(b.x - b.ox * 2, Y + 0.08, b.z - b.oz * 2, b.x + b.ox * 14, 0.25, b.z + b.oz * 14);
      if (i < beach.length - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const sand = new THREE.Mesh(g, new THREE.MeshToonMaterial({ color: PALETTE.sand, side: THREE.DoubleSide }));
    sand.receiveShadow = true;
    life.add(sand);
    const umbrellaCols = ['#ff6a4d', '#ffc845', '#4d7cff', '#2f9e55', '#ffffff'];
    beach.forEach((b, i) => {
      if (i % 2) return;
      const x = b.x + b.ox * 6, z = b.z + b.oz * 6, y = 0.9;
      life.add(solid(new THREE.CylinderGeometry(0.08, 0.08, 3.6, 4).translate(x, y + 1.8, z), '#ffffff', { outlineWidth: 0 }));
      life.add(solid(new THREE.ConeGeometry(2.2, 1, 8).translate(x, y + 3.8, z), umbrellaCols[i % umbrellaCols.length], { outlineWidth: 0.05 }));
      life.add(solid(new THREE.BoxGeometry(1.6, 0.08, 3).rotateY(R()).translate(x + 2, y + 0.05, z + 1), umbrellaCols[(i + 2) % umbrellaCols.length], { outlineWidth: 0 }));
      if (R() < 0.6) {
        const p = person({ shirt: umbrellaCols[(i + 1) % 5] });
        p.scale.setScalar(S * 0.9);
        p.rotation.x = -Math.PI / 2; // allongé au soleil
        p.position.set(x + 2, y + 0.4, z - 1);
        life.add(p);
      }
      circles.push({ x: b.x + b.ox * 10, z: b.z + b.oz * 10, r: 5 });
    });
    // Vagues : des rouleaux d'écume qui arrivent du large et meurent sur le sable.
    const foam = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false });
    for (let k = 0; k < 4; k++) {
      const wave = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.4).rotateX(-Math.PI / 2), foam.clone());
      life.add(wave);
      const mid = beach[Math.floor(beach.length / 2)];
      const span = Math.hypot(beach[beach.length - 1].x - beach[0].x, beach[beach.length - 1].z - beach[0].z);
      anim.push((dt, t) => {
        const u = (t * 0.18 + k / 4) % 1;
        const d = 34 - u * 22;
        wave.position.set(mid.x + mid.ox * d, 0.3, mid.z + mid.oz * d);
        wave.rotation.y = Math.atan2(mid.ox, mid.oz);
        wave.scale.set(span * (0.6 + u * 0.35), 1, 1);
        wave.material.opacity = Math.sin(u * Math.PI) * 0.85;
      });
    }
  }

  // --- Parc : pelouse, allées en croix, étang, bancs, arbres.
  const park = { x: 390, z: -350, rx: 58, rz: 32 };
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ color: PALETTE.grass }));
  lawn.scale.set(park.rx, 1, park.rz);
  lawn.position.set(park.x, Y + 0.05, park.z);
  lawn.receiveShadow = true;
  life.add(lawn);
  life.add(solid(new THREE.BoxGeometry(park.rx * 2 - 6, 0.06, 3).translate(park.x, Y + 0.08, park.z), '#efe6d2', { outlineWidth: 0, cast: false }));
  life.add(solid(new THREE.BoxGeometry(3, 0.06, park.rz * 2 - 6).translate(park.x, Y + 0.08, park.z), '#efe6d2', { outlineWidth: 0, cast: false }));
  const pond = new THREE.Mesh(new THREE.CircleGeometry(7, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#6cc6dc' }));
  pond.position.set(park.x + 20, Y + 0.09, park.z - 9);
  life.add(pond);
  block(park.x + 20, park.z - 9, 7, 7);
  // --- Escalade : trois blocs de rocher avec prises colorées et crash pads, deux grimpeurs et un pareur.
  const CLIMB = { x: park.x + 29, z: park.z + 14 };
  {
    const holds = ['#e8404a', '#ffc845', '#2f9e55', '#4d7cff', '#a25dd9', '#ff6a4d'];
    const rocks = [{ dx: -6, dz: -3, r: 4.6, h: 1.55, ry: 0.4 }, { dx: 5, dz: -1, r: 3.8, h: 1.35, ry: 1.3 }, { dx: 0, dz: 7, r: 3.2, h: 1.1, ry: 2.2 }];
    const RR = rng(77);
    for (const rk of rocks) {
      const g = new THREE.Group();
      g.position.set(CLIMB.x + rk.dx, Y, CLIMB.z + rk.dz);
      g.rotation.y = rk.ry;
      g.add(solid(new THREE.DodecahedronGeometry(rk.r, 0).scale(1, rk.h, 0.85).translate(0, rk.r * rk.h * 0.62, 0), '#9aa3ad', { outlineWidth: 0.1 }));
      // Prises colorées sur la face sud du bloc.
      for (let k = 0; k < 9; k++) {
        const a = -0.9 + RR() * 1.8, yy = 0.6 + RR() * rk.r * rk.h * 1.15;
        const hold = solid(new THREE.IcosahedronGeometry(0.28, 0), holds[k % holds.length], { outlineWidth: 0 });
        hold.position.set(Math.sin(a) * rk.r * 0.78, yy, Math.cos(a) * rk.r * 0.72);
        g.add(hold);
      }
      life.add(g);
      blocks.circles.push({ x: CLIMB.x + rk.dx, z: CLIMB.z + rk.dz, r: rk.r * 0.9 });
    }
    // Crash pads au pied des blocs.
    for (const [dx, dz] of [[-6, 2], [5, 3.5]]) life.add(solid(new THREE.BoxGeometry(4.6, 0.6, 3).translate(CLIMB.x + dx, Y + 0.3, CLIMB.z + dz), '#2f6fd6', { outlineWidth: 0.05 }));
    // Deux grimpeurs : ils montent prise après prise, puis redescendent ; un pareur suit le premier.
    const climbers = [{ rk: rocks[0], shirt: '#ff6a4d', ph: 0, dur: 9 }, { rk: rocks[1], shirt: '#2f9e55', ph: 4, dur: 7.5 }];
    for (const c of climbers) {
      const p = person({ shirt: c.shirt, pants: '#26324a' });
      p.scale.setScalar(S * 0.85);
      life.add(p);
      const top = c.rk.r * c.rk.h * 0.9;
      const bx = CLIMB.x + c.rk.dx, bz = CLIMB.z + c.rk.dz;
      anim.push((dt, t) => {
        const u = ((t + c.ph) % c.dur) / c.dur;
        // 0 → 0,8 : la montée ; 0,8 → 1 : la désescalade rapide.
        const k = u < 0.8 ? u / 0.8 : 1 - (u - 0.8) / 0.2;
        const y = 0.2 + k * top * 0.75;
        const reach = u < 0.8 ? Math.sin(u * 40) : 0;
        p.position.set(bx, Y + y, bz + c.rk.r * 0.78 + 0.6 - k * 1.2);
        p.rotation.y = Math.PI; // face au rocher
        p.userData.arms.forEach((a, i) => { a.rotation.x = Math.PI - 0.4 + (i ? reach : -reach) * 0.35; });
        p.userData.legs.forEach((l, i) => { l.rotation.x = 0.35 + (i ? -reach : reach) * 0.4; });
      });
    }
    const spotter = person({ shirt: '#ffc845', pants: '#55607a' });
    spotter.scale.setScalar(S * 0.85);
    spotter.position.set(CLIMB.x - 6, Y, CLIMB.z + 6.5);
    spotter.rotation.y = Math.PI;
    spotter.userData.arms.forEach((a) => { a.rotation.x = 2.2; });
    life.add(spotter);
  }
  const climbFree = (x, z) => Math.hypot(x - CLIMB.x, z - CLIMB.z - 2) > 14;

  // --- Le codeur : assis à une table de pique-nique, portable ouvert, sweat à capuche et lunettes.
  const CODE = { x: park.x - 30, z: park.z + 13 };
  {
    const wood = PALETTE.wood, metal = '#55607a';
    const g = new THREE.Group();
    g.position.set(CODE.x, Y, CODE.z);
    g.add(solid(new THREE.BoxGeometry(6, 0.3, 3).translate(0, 2.3, 0), wood, { outlineWidth: 0.05 }));
    for (const dx of [-2.5, 2.5]) g.add(solid(new THREE.BoxGeometry(0.25, 2.3, 2.6).translate(dx, 1.15, 0), metal, { outlineWidth: 0.03 }));
    for (const dz of [-2.6, 2.6]) g.add(solid(new THREE.BoxGeometry(6, 0.25, 1.1).translate(0, 1.3, dz), wood, { outlineWidth: 0.04 }));
    // Le portable, écran tourné vers le codeur (au nord), qui luit.
    g.add(solid(new THREE.BoxGeometry(2, 0.1, 1.3).translate(0, 2.5, -0.2), '#cfd6e0', { outlineWidth: 0.03 }));
    g.add(solid(new THREE.BoxGeometry(2, 1.3, 0.1).rotateX(0.25).translate(0, 3.15, 0.45), '#cfd6e0', { outlineWidth: 0.03 }));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshBasicMaterial({ color: '#173b2c' }));
    screen.position.set(0, 3.15, 0.38);
    screen.rotation.set(0.25, Math.PI, 0);
    g.add(screen);
    // Canette de boisson énergisante.
    g.add(solid(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 8).translate(1.6, 2.8, 0.3), '#2f9e55', { outlineWidth: 0.02 }));
    life.add(g);
    blocks.circles.push({ x: CODE.x, z: CODE.z, r: 3.4 });
    const nerd = person({ shirt: '#3c4a5c', pants: '#26324a', hair: '#2b1d16' });
    nerd.scale.setScalar(S);
    nerd.position.set(CODE.x, Y + 1.45 - 0.95 * S, CODE.z - 2.4);
    nerd.userData.legs.forEach((l) => { l.rotation.x = -1.45; });
    // Lunettes et capuche.
    for (const sx of [-0.09, 0.09]) {
      const lens = solid(new THREE.TorusGeometry(0.07, 0.018, 4, 10).translate(sx, 1.99, 0.27), '#1d2533', { outlineWidth: 0 });
      nerd.add(lens);
    }
    nerd.add(solid(new THREE.SphereGeometry(0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.55).rotateX(-0.6).translate(0, 1.95, -0.1), '#3c4a5c', { outlineWidth: 0.03 }));
    life.add(nerd);
    anim.push((dt, t) => {
      // Il tape vite, avec de petites pauses pour réfléchir.
      const busy = Math.sin(t * 0.7) > -0.4;
      nerd.userData.arms.forEach((a, k) => { a.rotation.x = busy ? -1.15 + Math.sin(t * 16 + k * 2) * 0.12 : -1.0; });
      nerd.rotation.y = busy ? 0 : Math.sin(t * 2) * 0.08;
    });
  }
  const codeFree = (x, z) => Math.hypot(x - CODE.x, z - CODE.z) > 9;
  for (let k = 0; k < 26; k++) {
    const a = R() * Math.PI * 2, rr = 0.45 + R() * 0.45;
    const x = park.x + Math.cos(a) * park.rx * rr, z = park.z + Math.sin(a) * park.rz * rr;
    if (Math.abs(x - park.x) < 4 || Math.abs(z - park.z) < 4 || Math.hypot(x - park.x - 20, z - park.z + 9) < 10 || !climbFree(x, z) || !codeFree(x, z)) continue;
    if (blocks.boxes.some((b) => Math.abs(x - b.x) < b.hx + 2 && Math.abs(z - b.z) < b.hz + 2)) continue; // ex. la muscu
    const t = leafy(R, Y);
    t.position.set(x, 0, z);
    life.add(t);
    blocks.circles.push({ x, z, r: 1.2 });
  }
  for (const [dx, dz, ry] of [[-14, -4, 0], [14, 4, Math.PI], [-4, 12, Math.PI / 2], [4, -12, -Math.PI / 2]]) {
    const b = new THREE.Group();
    b.add(solid(new THREE.BoxGeometry(3.4, 0.3, 1).translate(0, 1, 0), PALETTE.wood, { outlineWidth: 0.04 }));
    b.add(solid(new THREE.BoxGeometry(3.4, 1, 0.2).translate(0, 1.6, -0.45), PALETTE.wood, { outlineWidth: 0.04 }));
    b.position.set(park.x + dx, Y, park.z + dz);
    b.rotation.y = ry;
    life.add(b);
  }
  // Piste de course autour du parc (entre la pelouse et la route), et ses joggeurs qui tournent.
  const TRACK = { rx: park.rx + 7, rz: park.rz + 6, w: 1.4 };
  const roadDashMat = new THREE.MeshBasicMaterial({ color: '#f6f1e7' });
  {
    const N = 120, pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      let nx = c / TRACK.rx, nz = s / TRACK.rz;
      const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
      const x = park.x + c * TRACK.rx, z = park.z + s * TRACK.rz;
      pos.push(x - nx * TRACK.w, Y + 0.07, z - nz * TRACK.w, x + nx * TRACK.w, Y + 0.07, z + nz * TRACK.w);
      if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const track = new THREE.Mesh(g, new THREE.MeshToonMaterial({ color: '#d9734e', side: THREE.DoubleSide }));
    track.receiveShadow = true;
    life.add(track);
    // Ligne de couloir en pointillés.
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 1.6).rotateX(-Math.PI / 2), roadDashMat);
      m.position.set(park.x + Math.cos(a) * TRACK.rx, Y + 0.1, park.z + Math.sin(a) * TRACK.rz);
      m.rotation.y = Math.atan2(-Math.sin(a) * TRACK.rx, Math.cos(a) * TRACK.rz);
      life.add(m);
    }
  }
  ['#ff6a4d', '#4d7cff', '#ffc845', '#2f9e55', '#a25dd9'].forEach((shirt, i) => {
    const r = person({ shirt, pants: '#26324a' });
    r.scale.setScalar(S);
    life.add(r);
    const speed = 6.5 + i * 0.8, ph = (i / 5) * Math.PI * 2, lane = i % 2 ? 0.6 : -0.6;
    const per = Math.PI * (3 * (TRACK.rx + TRACK.rz) - Math.sqrt((3 * TRACK.rx + TRACK.rz) * (TRACK.rx + 3 * TRACK.rz))); // périmètre (Ramanujan)
    anim.push((dt, t) => {
      const a = ph + ((t * speed) / per) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const tx = -s * TRACK.rx, tz = c * TRACK.rz, tl = Math.hypot(tx, tz);
      r.position.set(park.x + c * (TRACK.rx + lane), Y + Math.abs(Math.sin(t * 9 + i)) * 0.35, park.z + s * (TRACK.rz + lane));
      r.rotation.y = Math.atan2(tx / tl, tz / tl);
      r.userData.legs.forEach((l, k) => { l.rotation.x = Math.sin(t * 9 + i + k * Math.PI) * 0.9; });
      r.userData.arms.forEach((l, k) => { l.rotation.x = -Math.sin(t * 9 + i + k * Math.PI) * 0.8; });
    });
  });

  for (const [dx, dz] of [[-park.rx + 4, 0], [park.rx - 4, 0], [0, -park.rz + 4], [0, park.rz - 4]]) {
    const l = lampPost(Y);
    l.position.set(park.x + dx, 0, park.z + dz);
    life.add(l);
  }


  // --- Réseau routier : une boucle autour du parc et des branches vers chaque bâtiment.
  const roadSamples = [];
  const roadLines = []; // tracés des rues, pour les cartes (rapport de course)
  const lampSpots = []; // emplacements de lampadaires le long des routes
  const tanR = new THREE.Vector3();
  const road = (pts, closed = false, w = 3.6) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, Y + 0.07, z)), closed, 'catmullrom', 0.5);
    const N = Math.max(12, Math.round(curve.getLength() / 2.5));
    roadLines.push(curve.getSpacedPoints(Math.max(8, Math.round(N / 3))).map((p) => ({ x: p.x, z: p.z })));
    const pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const u = closed ? (i % N) / N : i / N;
      const p = curve.getPointAt(u);
      curve.getTangentAt(u, tanR);
      pos.push(p.x - tanR.z * w, Y + 0.07, p.z + tanR.x * w, p.x + tanR.z * w, Y + 0.07, p.z - tanR.x * w);
      if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      if (i % 2 === 0) roadSamples.push({ x: p.x, z: p.z });
      if (i % 10 === 5) {
        const sd = (i / 10) % 2 < 1 ? 1 : -1, off = w + 1.8;
        lampSpots.push({ x: p.x - tanR.z * off * sd, z: p.z + tanR.x * off * sd, ry: Math.atan2(tanR.z * sd, -tanR.x * sd) });
      }
      if (i % 3 === 0 && i < N) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1.6).rotateX(-Math.PI / 2), roadDash);
        m.position.set(p.x, Y + 0.12, p.z);
        m.rotation.y = Math.atan2(tanR.x, tanR.z);
        life.add(m);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, roadMat);
    mesh.receiveShadow = true;
    life.add(mesh);
    return curve;
  };
  const roadMat = new THREE.MeshToonMaterial({ color: '#4b5566', side: THREE.DoubleSide });
  const roadDash = new THREE.MeshBasicMaterial({ color: '#f6f1e7' });
  const ring = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return [park.x + Math.cos(a) * (park.rx + 18), park.z + Math.sin(a) * (park.rz + 14)];
  });
  const loopRoad = road(ring, true);
  // Carrefour : un disque d'asphalte qui comble la jonction de deux routes.
  const junction = (x, z, r = 4.6) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 16).rotateX(-Math.PI / 2), roadMat);
    m.position.set(x, Y + 0.075, z);
    m.receiveShadow = true;
    life.add(m);
  };
  // Branche qui quitte la boucle à l'angle donné, d'abord perpendiculaire, puis vers ses destinations.
  const spur = (angle, rest) => {
    const ax = park.x + Math.cos(angle) * (park.rx + 18), az = park.z + Math.sin(angle) * (park.rz + 14);
    const nx = Math.cos(angle) / (park.rx + 18), nz = Math.sin(angle) / (park.rz + 14);
    const nl = Math.hypot(nx, nz);
    junction(ax, az);
    road([[ax, az], [ax + (nx / nl) * 10, az + (nz / nl) * 10], ...rest]);
    const end = rest[rest.length - 1];
    junction(end[0], end[1], 4);
  };
  spur(Math.PI, [[296, -347], [287, -342]]); // vers la vieille ville
  spur(Math.PI * 0.72, [[322, -306], [306, -304]]); // capitainerie
  spur(Math.PI * 0.32, [[458, -307], [470, -303]]); // K-Challenge
  spur(Math.PI * 0.06, [[486, -326], [500, -317], [540, -317], [546, -340], [542, -362], [541, -372]]); // marché, entrepôts, tour
  spur(-Math.PI * 0.12, [[468, -392], [466, -410], [470, -426], [462, -432], [430, -432], [360, -431], [305, -431]]); // campus : dessert les trois écoles

  // Lampadaires le long des routes : pas sur une autre chaussée, pas dans un bâtiment, pas trop serrés.
  const placedLamps = [];
  for (const s of lampSpots) {
    if (!insidePoly(poly.pts, s.x, s.z) || nearestOnPoly(poly.pts, s.x, s.z).d < 4) continue;
    if (roadSamples.some((p) => Math.hypot(p.x - s.x, p.z - s.z) < 4.6)) continue;
    if (blocks.boxes.some((b) => Math.abs(s.x - b.x) < b.hx + 1 && Math.abs(s.z - b.z) < b.hz + 1)) continue;
    if (blocks.circles.some((c) => Math.hypot(s.x - c.x, s.z - c.z) < c.r + 1)) continue;
    if ((blocks.noTree || []).some((b) => Math.abs(s.x - b.x) < b.hx && Math.abs(s.z - b.z) < b.hz)) continue; // parkings, parvis
    if (placedLamps.some((q) => Math.hypot(q.x - s.x, q.z - s.z) < 14)) continue;
    const l = lampPost(Y);
    l.position.set(s.x, 0, s.z);
    l.rotation.y = s.ry;
    life.add(l);
    placedLamps.push(s);
    blocks.circles.push({ x: s.x, z: s.z, r: 0.5 });
  }

  // Voitures et vélos sur la boucle (voitures à droite, vélos sur le bord).
  const bike = (shirt) => {
    const g = new THREE.Group();
    for (const z of [-0.9, 0.9]) g.add(solid(new THREE.TorusGeometry(0.55, 0.08, 4, 10).rotateY(Math.PI / 2).translate(0, 0.6, z), '#1d2533', { outlineWidth: 0 }));
    g.add(solid(new THREE.BoxGeometry(0.1, 0.1, 1.8).translate(0, 1.0, 0), '#e8404a', { outlineWidth: 0 }));
    const rider = person({ shirt });
    rider.scale.setScalar(0.85);
    rider.position.set(0, 0.2, 0);
    rider.userData.legs.forEach((l) => { l.rotation.x = -0.9; });
    rider.userData.arms.forEach((a) => { a.rotation.x = -1.2; });
    g.add(rider);
    g.scale.setScalar(S * 0.95);
    return g;
  };
  const movers = [
    ...CAR_COLORS.slice(0, 3).map((c, i) => ({ m: car(c), off: i / 3, speed: 0.022, lane: 1.7 })),
    ...['#ffc845', '#3ec7c2', '#ff6a4d'].map((c, i) => ({ m: bike(c), off: i / 3 + 0.15, speed: -0.009, lane: 3.4 })),
  ];
  for (const v of movers) {
    life.add(v.m);
    anim.push((dt, t) => {
      const u = (((v.off + t * v.speed) % 1) + 1) % 1;
      const p = loopRoad.getPointAt(u);
      loopRoad.getTangentAt(u, tanR);
      const dir = v.speed > 0 ? 1 : -1;
      // À droite dans le sens de la marche.
      v.m.position.set(p.x - tanR.z * v.lane * dir, Y, p.z + tanR.x * v.lane * dir);
      v.m.rotation.y = Math.atan2(tanR.x * dir, tanR.z * dir);
    });
  }

  // --- Supermarché et son parking.
  {
    const sx = 500, sz = -352;
    const g = new THREE.Group();
    g.position.set(sx, Y, sz);
    g.add(solid(new THREE.BoxGeometry(36, 8, 20).translate(0, 4, 0), '#eef1f4', { outlineWidth: 0.15 }));
    g.add(solid(new THREE.BoxGeometry(36.4, 1.6, 20.4).translate(0, 7.4, 0), '#2f9e55', { outlineWidth: 0.08 }));
    g.add(solid(new THREE.BoxGeometry(14, 4.5, 0.3).translate(0, 2.3, 10.1), '#bfe9f5', { outlineWidth: 0.05 }));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: signTexture('MARCHÉ', '#2f9e55', '#ffffff') }));
    sign.position.set(0, 10.2, 10.25);
    g.add(sign);
    g.add(solid(new THREE.BoxGeometry(14.4, 4, 0.3).translate(0, 10.2, 10.05), '#1d2533', { outlineWidth: 0.04 }));
    life.add(g);
    block(sx, sz, 18.5, 10.5);
    // Parking : bitume, lignes blanches, voitures garées, chariots.
    life.add(solid(new THREE.BoxGeometry(58, 0.08, 18).translate(510, Y + 0.05, -317), '#4b5566', { outlineWidth: 0, cast: false }));
    const line = new THREE.MeshBasicMaterial({ color: '#f6f1e7' });
    for (let k = 0; k <= 9; k++) {
      for (const side of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 6).rotateX(-Math.PI / 2), line);
        m.position.set(484 + k * 5.8, Y + 0.1, -317 + side * 5);
        life.add(m);
      }
      if (k < 9) for (const side of [-1, 1]) {
        if (R() < 0.35) continue;
        const c = car(CAR_COLORS[Math.floor(R() * CAR_COLORS.length)]);
        c.position.set(486.9 + k * 5.8, Y, -317 + side * 5);
        c.rotation.y = side > 0 ? Math.PI : 0;
        life.add(c);
        blocks.boxes.push({ x: 486.9 + k * 5.8, z: -317 + side * 5, hx: 1.8, hz: 3.4 });
      }
    }
  }

  // --- Tour de bureaux et entrepôts à l'est (le nord est laissé aux campus).
  {
    const g = new THREE.Group();
    g.position.set(562, Y, -370);
    g.add(solid(new THREE.BoxGeometry(12, 34, 12).translate(0, 17, 0), '#3c4a5c', { outlineWidth: 0.15 }));
    for (let f = 1; f < 11; f++) g.add(solid(new THREE.BoxGeometry(12.4, 0.5, 12.4).translate(0, f * 3.1, 0), '#4aa4de', { outlineWidth: 0 }));
    g.add(solid(new THREE.BoxGeometry(6, 3, 6).translate(0, 35.5, 0), '#9aa3ad', { outlineWidth: 0.08 }));
    life.add(g);
    block(562, -370, 6.5, 6.5);
  }
  for (let k = 0; k < 2; k++) {
    const x = 560, z = -340 + k * 26;
    const g = new THREE.Group();
    g.position.set(x, Y, z);
    g.add(solid(new THREE.BoxGeometry(20, 9, 18).translate(0, 4.5, 0), '#c9b8a0', { outlineWidth: 0.14 }));
    g.add(solid(new THREE.CylinderGeometry(9.5, 9.5, 20, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.35, 1).translate(0, 9, 0), '#8a9aa8', { outlineWidth: 0.1 }));
    g.add(solid(new THREE.BoxGeometry(6, 6, 0.3).translate(-4, 3, 9.1), '#5a6b7c', { outlineWidth: 0.05 }));
    life.add(g);
    block(x, z, 10.5, 9.5);
  }

  // --- Arbres un peu partout sur l'île, là où il reste de la place (pins, feuillus, palmiers près de l'eau).
  const free = (x, z, r) => {
    if (!insidePoly(poly.pts, x, z)) return false;
    if (nearestOnPoly(poly.pts, x, z).d < 13) return false; // laisse la corniche libre
    if (Math.hypot((x - park.x) / park.rx, (z - park.z) / park.rz) < 1.32) return false; // parc et sa piste de course
    if (z > -290) return false; // front de mer
    if (roadSamples.some((p) => Math.hypot(p.x - x, p.z - z) < 7)) return false;
    for (const b of blocks.boxes) if (Math.abs(x - b.x) < b.hx + r && Math.abs(z - b.z) < b.hz + r) return false;
    for (const c of blocks.circles) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false;
    for (const b of blocks.noTree || []) if (Math.abs(x - b.x) < b.hx + r && Math.abs(z - b.z) < b.hz + r) return false; // parvis, places
    return true;
  };
  let planted = 0;
  for (let k = 0; k < 1400 && planted < 170; k++) {
    const x = 170 + R() * 420, z = -485 + R() * 200;
    if (!free(x, z, 3)) continue;
    const kind = R();
    const nearSea = nearestOnPoly(poly.pts, x, z).d < 22;
    const gy = groundAt(x, z);
    const t = nearSea && kind < 0.6 ? palm(R, gy) : kind < 0.5 ? pine(R, gy) : leafy(R, gy);
    t.position.set(x, 0, z);
    t.rotation.y = R() * 6;
    life.add(t);
    blocks.circles.push({ x, z, r: 1.3 });
    planted++;
  }
  return { roads: roadLines, park, climb: CLIMB, code: CODE };
}
