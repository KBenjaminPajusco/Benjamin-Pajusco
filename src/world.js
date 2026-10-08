import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { solid, toon, rng, PALETTE } from './toon.js';
import { makeWater } from './effects.js';
import { person } from './characters.js';
import { buildCafe } from './cafe.js';
import { buildMatchRace } from './matchrace.js';
import { buildPhare } from './phare.js';
import { Boat } from './boat.js';
import { buildDecor } from './decor.js';
import { buildTown } from './town.js';
import { buildIsland, insidePoly, nearestOnPoly } from './island.js';
import { buildIslandLife } from './islandlife.js';
import { EXPERIENCES, EDUCATION, PLACES, INTERESTS, PROFILE, AI_FLOW } from './cv.js';

// Plan du monde (le vent vient du nord, -z) :
//   départ + nom flottant au centre, chenal du parcours vers l'est,
//   île Formation à l'ouest, île Monde au nord-ouest, zone perf au nord, port au nord-est.
// Le port est déplacé d'un bloc depuis ses coordonnées de construction (voir shiftSince).
export const HARBOUR_SHIFT = { x: -360, z: 40 };

// Lieux mis de côté pour l'instant (gardés dans le code, pas construits).
export const FEATURES = { monde: false, perf: false };

export const LAYOUT = {
  start: { x: -10, z: 140 },
  title: { x: -30, z: 28 },
  phare: { x: 150, z: -110 }, // à l'entrée du port : le chenal passe devant
  formation: { x: -265, z: 60, r: 50 },
  monde: { x: -95, z: -95, r: 26 },
  perf: { windward: { x: 40, z: -250 }, gate: [{ x: 10, z: -130 }, { x: 70, z: -130 }] },
  quay: { x: 377.5, z: -352, hx: 177.5, hz: 84 },
};

const FONT = {
  B: ['11110', '10001', '11110', '10001', '11110'],
  E: ['11111', '10000', '11110', '10000', '11111'],
  N: ['10001', '11001', '10101', '10011', '10001'],
  J: ['00111', '00010', '00010', '10010', '01100'],
  A: ['01110', '10001', '11111', '10001', '10001'],
  M: ['10001', '11011', '10101', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '11111'],
  P: ['11110', '10001', '11110', '10000', '10000'],
  U: ['10001', '10001', '10001', '10001', '01110'],
  S: ['01111', '10000', '01110', '00001', '11110'],
  C: ['01111', '10000', '10000', '10000', '01111'],
  O: ['01110', '10001', '10001', '10001', '01110'],
};

function flagTexture(code) {
  const c = document.createElement('canvas');
  c.width = 96; c.height = 64;
  const x = c.getContext('2d');
  const stripes = { FR: ['#2b4fbf', '#ffffff', '#e8404a'], IT: ['#2f9e55', '#ffffff', '#e8404a'], CA: ['#e8404a', '#ffffff', '#e8404a'] }[code];
  stripes.forEach((s, i) => { x.fillStyle = s; x.fillRect(i * 32, 0, 32, 64); });
  if (code === 'CA') { x.fillStyle = '#e8404a'; x.fillRect(40, 22, 16, 20); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Couleur dominante d'un logo (hors blanc, noir, gris et transparent), pour habiller la bouée à ses couleurs.
function dominantColor(ctx, size) {
  const d = ctx.getImageData(0, 0, size, size).data;
  const bins = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
    if (a < 200) continue;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max < 25 || max - min < 30) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    bins.set(key, (bins.get(key) || 0) + 1);
  }
  let best = null, n = 0;
  for (const [k, v] of bins) if (v > n) { n = v; best = k; }
  if (best === null || n < 20) return null;
  return new THREE.Color().setRGB(((best >> 8) * 17) / 255, (((best >> 4) & 15) * 17) / 255, ((best & 15) * 17) / 255, THREE.SRGBColorSpace);
}

export function badgeTexture(exp, onColor) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const disc = () => {
    x.clearRect(0, 0, 256, 256);
    x.beginPath(); x.arc(128, 128, 118, 0, Math.PI * 2);
    x.fillStyle = '#ffffff'; x.fill();
    x.lineWidth = 12; x.strokeStyle = '#1d2533'; x.stroke();
  };
  disc();
  x.beginPath(); x.arc(128, 128, 100, 0, Math.PI * 2);
  x.fillStyle = exp.brand.color; x.fill();
  x.fillStyle = exp.brand.ink || '#ffffff';
  x.font = `bold ${exp.brand.mono.length > 2 ? 62 : 96}px "Space Grotesk", sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(exp.brand.mono, 128, 134);
  const img = new Image();
  img.onload = () => {
    disc();
    const w = img.naturalWidth || 300, h = img.naturalHeight || 150;
    const s = exp.brand.round ? 232 : 164, k = Math.min(s / w, s / h);
    x.drawImage(img, 128 - (w * k) / 2, 128 - (h * k) / 2, w * k, h * k);
    tex.needsUpdate = true;
    if (onColor) {
      const probe = document.createElement('canvas');
      probe.width = probe.height = 64;
      const px = probe.getContext('2d');
      px.drawImage(img, 0, 0, 64, 64);
      const col = dominantColor(px, 64);
      if (col) onColor(col);
    }
  };
  if (exp.logo) img.src = exp.logo;
  return tex;
}

function flag(code, h = 6) {
  const g = new THREE.Group();
  g.add(solid(new THREE.CylinderGeometry(0.12, 0.12, h, 5).translate(0, h / 2, 0), '#dfe3e8', { outlineWidth: 0.05 }));
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6, 4, 1).translate(1.2, 0, 0), toon('#ffffff', { map: flagTexture(code), side: THREE.DoubleSide }));
  cloth.position.y = h - 0.9;
  cloth.castShadow = true;
  g.add(cloth);
  g.userData.cloth = cloth;
  return g;
}

function tree(R) {
  const g = new THREE.Group();
  const h = 4 + R() * 3;
  g.add(solid(new THREE.CylinderGeometry(0.3, 0.4, 1.6, 5).translate(0, 0.8, 0), PALETTE.wood, { outlineWidth: 0.1 }));
  g.add(solid(new THREE.ConeGeometry(1.8 + R() * 0.6, h, 6).translate(0, 1.4 + h / 2, 0), R() > 0.5 ? PALETTE.grassDark : '#4f8f4a', { outlineWidth: 0.12 }));
  g.rotation.y = R() * 6;
  return g;
}

// Silhouette organique : rayon modulé par l'angle, continu à la couture du cylindre.
function wobble(geo, seed, amp = 1) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + amp * (0.08 * Math.sin(3 * a + seed) + 0.05 * Math.sin(7 * a + seed * 2.3));
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildWorld(scene) {
  const circles = [];
  const boxes = [];
  const segs = [];
  // Terre ferme (où l'on peut marcher) et obstacles à terre.
  const land = { boxes: [], circles: [], polys: [], hills: [] };
  const blocks = { boxes: [], circles: [] };
  let cafeLoop = null;
  let portIsland = null;
  const zones = [];
  const labels = [];
  const anim = [];
  const map = { islands: [], boxes: [], buoys: [], marks: [], roads: [] };
  const root = new THREE.Group();
  scene.add(root);

  // Instantané des tableaux du monde, pour déplacer après coup tout ce qui a été ajouté depuis.
  const snapshot = () => ({
    root: root.children.length, circles: circles.length, boxes: boxes.length, segs: segs.length,
    landB: land.boxes.length, landC: land.circles.length, landP: land.polys.length, landH: land.hills.length, blockB: blocks.boxes.length, blockC: blocks.circles.length,
    zones: zones.length, labels: labels.length, mapB: map.boxes.length, mapI: map.islands.length, mapR: map.roads.length,
  });
  function shiftSince(snap, dx, dz) {
    root.children.slice(snap.root).forEach((o) => { o.position.x += dx; o.position.z += dz; });
    const xz = (o) => { o.x += dx; o.z += dz; };
    circles.slice(snap.circles).forEach(xz);
    boxes.slice(snap.boxes).forEach(xz);
    land.boxes.slice(snap.landB).forEach(xz);
    land.circles.slice(snap.landC).forEach(xz);
    land.hills.slice(snap.landH).forEach(xz);
    land.polys.slice(snap.landP).forEach((p) => p.pts.forEach((v) => { v.x += dx; v.y += dz; }));
    blocks.boxes.slice(snap.blockB).forEach(xz);
    blocks.circles.slice(snap.blockC).forEach(xz);
    map.boxes.slice(snap.mapB).forEach(xz);
    map.islands.slice(snap.mapI).forEach(xz);
    map.roads.slice(snap.mapR).forEach((r) => r.forEach(xz));
    segs.slice(snap.segs).forEach((g) => { g[0] += dx; g[1] += dz; g[2] += dx; g[3] += dz; });
    labels.slice(snap.labels).forEach((l) => { l.pos.x += dx; l.pos.z += dz; });
    zones.slice(snap.zones).forEach((z) => {
      xz(z);
      if (z.land) xz(z.land);
      if (z.look) xz(z.look);
      if (z.anchor) { z.anchor.x += dx; z.anchor.z += dz; }
    });
  }

  const addIsland = (x, z, r, seed, { trees = 6, hill = 1 } = {}) => {
    const R = rng(seed);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(solid(wobble(new THREE.CylinderGeometry(r, r * 1.08, 2.6, 12).translate(0, -0.7, 0), seed), PALETTE.sand, { outlineWidth: 0.25 }));
    g.add(solid(wobble(new THREE.CylinderGeometry(r * 0.76, r * 0.84, 1.3, 11).translate(0, 1.2, 0), seed + 1, 1.4), PALETTE.grass, { outlineWidth: 0.2 }));
    if (hill > 0) {
      const hillGeo = new THREE.IcosahedronGeometry(r * 0.38, 0).scale(1, 0.55 * hill, 1).translate(r * 0.12, 1.8, -r * 0.1);
      g.add(solid(hillGeo, PALETTE.grassDark, { outlineWidth: 0.2 }));
    }
    for (let i = 0; i < trees; i++) {
      const a = R() * Math.PI * 2, d = r * (0.25 + R() * 0.45);
      const t = tree(R);
      t.position.set(Math.cos(a) * d, 1.85, Math.sin(a) * d);
      g.add(t);
    }
    for (let i = 0; i < 4; i++) {
      const a = R() * Math.PI * 2;
      const rock = solid(new THREE.IcosahedronGeometry(1 + R() * 1.5, 0), PALETTE.rock, { outlineWidth: 0.12 });
      rock.position.set(Math.cos(a) * r * 0.98, 0.2, Math.sin(a) * r * 0.98);
      g.add(rock);
    }
    root.add(g);
    circles.push({ x, z, r: r + 1 });
    land.circles.push({ x, z, r: r * 0.95, y: 0.6, rTop: r * 0.76, yTop: 1.85 });
    map.islands.push({ x, z, r });
    return g;
  };

  // --- Nom flottant : des lettres-pontons qu'on peut bousculer en passant dedans.
  const letters = [];
  const cell = 3.4; // lettres assez grandes pour se lire depuis la vue d'ensemble
  const lines = [['BENJAMIN', 0], ['PAJUSCO', cell * 8.2]];
  for (const [word, dz] of lines) {
    const pitch = cell * 6.2;
    word.split('').forEach((ch, i) => {
      const parts = [];
      FONT[ch].forEach((row, r) => row.split('').forEach((on, c) => {
        if (on === '1') parts.push(new THREE.BoxGeometry(cell * 0.96, 1.6, cell * 0.96).translate((c - 2) * cell, 0, (r - 2) * cell));
      }));
      const mesh = solid(mergeGeometries(parts), i % 2 && dz === 0 ? PALETTE.accent : PALETTE.hull, { outlineWidth: 0.12 });
      const g = new THREE.Group();
      g.add(mesh);
      const hx = LAYOUT.title.x + (i - (word.length - 1) / 2) * pitch;
      const hz = LAYOUT.title.z + dz;
      g.position.set(hx, 0.3, hz);
      root.add(g);
      letters.push({ g, home: new THREE.Vector2(hx, hz), p: new THREE.Vector2(hx, hz), v: new THREE.Vector2(), rot: 0, w: 0, phase: Math.random() * 6 });
    });
  }
  labels.push({ pos: new THREE.Vector3(LAYOUT.title.x, 2, LAYOUT.title.z - 8), html: `<b>${PROFILE.title}</b><span>${PROFILE.tagline}</span>`, cls: 'label-title' });

  // --- Chenal du parcours : une bouée par expérience, dans l'ordre chronologique.
  const kindColor = { stage: PALETTE.stage, job: PALETTE.job, sport: PALETTE.sport };
  // Positions des bouées : le chenal part du départ et remonte vers l'entrée du port.
  const BUOYS = { naval: [72, 122], apcc: [118, 88], shn: [164, 122], segula: [210, 88], maliora: [265, 55], 'kc-stage': [330, 10], kc: [0, 0] };
  const buoyPositions = EXPERIENCES.map((e) => ({ x: BUOYS[e.id][0], z: BUOYS[e.id][1] }));
  const kcIndex = EXPERIENCES.findIndex((e) => e.id === 'kc');
  // Bâtiment K-Challenge et ponton d'arrivée dans le port (coordonnées finales, après déplacement du port).
  // Ponton K-Challenge à l'est du bassin, presque à la latitude de l'entrée : on y arrive au travers, pas au près.
  const kcBerth = { x: 520 + HARBOUR_SHIFT.x, z: -210 + HARBOUR_SHIFT.z };
  const harbourMouth = { x: 419 + HARBOUR_SHIFT.x, z: -168 + HARBOUR_SHIFT.z };
  // « Sportif de haut niveau » n'a pas de bouée : c'est le bateau comité du match race, au-dessus,
  // à mi-chemin entre APCC et Segula.
  const shnIndex = EXPERIENCES.findIndex((e) => e.id === 'shn');
  const committeeAt = {
    x: (buoyPositions[shnIndex - 1].x + buoyPositions[shnIndex + 1].x) / 2,
    z: Math.min(buoyPositions[shnIndex - 1].z, buoyPositions[shnIndex + 1].z) - 40,
  };
  // Le pointillé du chenal passe par le comité SHN, dans l'ordre chronologique.
  const chenal = [
    ...buoyPositions.map((p, i) => (i === shnIndex ? committeeAt : p)).filter((_, i) => i !== kcIndex),
    { x: LAYOUT.phare.x - 38, z: LAYOUT.phare.z + 12 }, // on passe au pied du phare
    harbourMouth, kcBerth,
  ];
  const dots = [];
  for (let i = 0; i < chenal.length - 1; i++) {
    const a = chenal[i], b = chenal[i + 1];
    for (let k = 1; k < 8; k++) {
      const t = k / 8;
      dots.push(new THREE.CircleGeometry(0.7, 6).rotateX(-Math.PI / 2).translate(THREE.MathUtils.lerp(a.x, b.x, t), 0.12, THREE.MathUtils.lerp(a.z, b.z, t)));
    }
  }
  root.add(new THREE.Mesh(mergeGeometries(dots), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 })));
  labels.push({ pos: new THREE.Vector3(40, 2, 106), html: 'Mon parcours <em>→</em>', cls: 'label-hint' });

  EXPERIENCES.forEach((exp, i) => {
    if (i === shnIndex || i === kcIndex) return;
    const { x, z } = buoyPositions[i];
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(1.7);
    const col = kindColor[exp.kind];
    const body = solid(new THREE.CylinderGeometry(1.1, 1.45, 3.0, 8).translate(0, 0.9, 0), exp.brand.color, { outlineWidth: 0.07 });
    body.material = body.material.clone();
    g.add(body);
    g.add(solid(new THREE.CylinderGeometry(1.16, 1.16, 0.5, 8).translate(0, 1.6, 0), '#ffffff', { outlineWidth: 0 }));
    g.add(solid(new THREE.CylinderGeometry(1.18, 1.18, 0.22, 8).translate(0, 1.95, 0), col, { outlineWidth: 0 }));
    // Plateau sous le médaillon, à la couleur de la marque.
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.5, 8).translate(0, 2.65, 0), body.material);
    plate.castShadow = true;
    g.add(plate);
    g.add(solid(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 5).translate(0, 3.8, 0), '#dfe3e8', { outlineWidth: 0.03 }));
    const f = flag(exp.flag, 4.6);
    f.position.set(0.5, 1, 0);
    f.scale.setScalar(0.6);
    g.add(f);
    // Médaillon de l'entreprise, toujours face caméra.
    const mapDot = { x, z, color: exp.brand.color };
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture(exp, (c) => {
      body.material.color.copy(c);
      mapDot.color = '#' + c.getHexString(THREE.SRGBColorSpace);
    }), depthWrite: false }));
    badge.scale.setScalar(4.2);
    badge.position.y = 7.4;
    g.add(badge);
    root.add(g);
    anim.push((dt, t) => {
      g.position.y = Math.sin(t * 1.6 + i) * 0.25;
      g.rotation.z = Math.sin(t * 1.1 + i) * 0.05;
      f.userData.cloth.rotation.y = Math.sin(t * 3 + i) * 0.25;
    });
    circles.push({ x, z, r: 2.6 });
    map.buoys.push(mapDot);
    addWaypoint(exp, x, z, 17, 12.6);
  });

  // Étiquette + zone + fiche d'une étape du parcours (bouée ou bateau comité).
  function addWaypoint(exp, x, z, labelY, anchorY) {
    const col = kindColor[exp.kind];
    labels.push({ pos: new THREE.Vector3(x, labelY, z), html: `${exp.year ? `<i>${exp.year}</i>` : ''}${exp.org}`, cls: `label-buoy k-${exp.kind}`, zone: exp.id, hideInZone: true });
    zones.push({
      id: exp.id, x, z, r: 26, zoom: 1.15, anchor: new THREE.Vector3(x, anchorY, z), geo: exp.geo && { ...exp.geo, place: exp.place, flag: exp.flag },
      card: {
        brand: exp.brand, logo: exp.logo,
        kicker: exp.year || exp.place, title: exp.org, sub: exp.role, tags: exp.tags, body: exp.body,
        // Sans année, le lieu est déjà en tête de fiche : on ne le répète pas en bas.
        meta: exp.year ? [exp.dates, exp.place].filter(Boolean).join(' · ') : exp.dates, accent: col,
      },
    });
  }

  // --- Match race : son bateau comité porte l'étape « Sportif de haut niveau ».
  {
    const exp = EXPERIENCES[shnIndex];
    const { committee } = buildMatchRace({ root, anim, labels, circles, map, committeeAt });
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture(exp), depthWrite: false }));
    badge.scale.setScalar(7);
    badge.position.set(committee.x, 13, committee.z);
    root.add(badge);
    anim.push((dt, t) => { badge.position.y = 13 + Math.sin(t * 1.6) * 0.3; });
    map.buoys.push({ x: committee.x, z: committee.z, color: exp.brand.color });
    addWaypoint(exp, committee.x, committee.z, 22, 17);
  }

  // --- Campus : un bâtiment par école, chacun avec son enseigne (posé sur le quai du port).
  function buildCampus(x, z, top, at) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    root.add(g);
    const sign = (e, h) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture(e), depthWrite: false }));
      sp.scale.setScalar(6);
      sp.position.y = h;
      return sp;
    };
    // Outils communs aux campus, en coordonnées locales du campus (c) dont l'origine monde est (wx, wz).
    const campusKit = (c, wx, wz) => {
      const noTree = (cx, cz, hx, hz) => (blocks.noTree ??= []).push({ x: wx + cx, z: wz + cz, hx, hz });
      // Plaque de façade : le nom de l'école, lisible de près.
      const plate = (text, w, px2, y, pz2, ry = 0, band = '#2f80c3') => {
        const cv = document.createElement('canvas');
        cv.width = 256; cv.height = 64;
        const k = cv.getContext('2d');
        k.fillStyle = '#ffffff'; k.fillRect(0, 0, 256, 64);
        k.fillStyle = band; k.fillRect(0, 54, 256, 10);
        k.fillStyle = '#1d2533'; k.font = '700 38px "Space Grotesk", Arial, sans-serif'; k.textAlign = 'center'; k.textBaseline = 'middle';
        k.fillText(text, 128, 28);
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: tex }));
        m.position.set(px2, y, pz2);
        m.rotation.y = ry;
        c.add(m);
      };
      const flat = (w, d, cx, cz, color, y = 0.06) => c.add(new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(cx, y, cz), toon(color)));
      // Parking : asphalte, places tracées et quelques voitures garées.
      const carCols = ['#e8404a', '#f6f1e7', '#4d7cff', '#1d2533', '#9aa3ad', '#ffc845', '#2f9e55'];
      let carK = 0;
      const parking = (cx, cz, cols, rows) => {
        const w = cols * 3, d = rows * 7 + 2;
        flat(w + 2, d, cx, cz, '#5b6574', 0.08);
        for (let r = 0; r < rows; r++) {
          const rz = cz - d / 2 + 1 + r * 7 + 3.5;
          for (let i = 0; i <= cols; i++) flat(0.18, 5, cx - w / 2 + i * 3, rz, '#f6f1e7', 0.1);
          for (let i = 0; i < cols; i++) {
            if ((i * 7 + r * 3 + carK) % 5 === 0) continue; // quelques places libres
            const car = solid(new THREE.BoxGeometry(1.8, 1.1, 3.8).translate(0, 0.75, 0), carCols[(i + r * 3 + carK) % carCols.length], { outlineWidth: 0.05 });
            car.add(solid(new THREE.BoxGeometry(1.6, 0.7, 2).translate(0, 1.6, -0.2), '#cfe3f2', { outlineWidth: 0.04 }));
            car.position.set(cx - w / 2 + 1.5 + i * 3, 0, rz);
            c.add(car);
          }
        }
        carK++;
        noTree(cx, cz, w / 2 + 1, d / 2);
      };
      // Pelouse (ou neige) aux bords arrondis : courbe lissée passant par quelques points.
      const lawn = (pts, color = '#8fc46d', y = 0.04) => {
        const curve = new THREE.CatmullRomCurve3(pts.map(([lx, lz]) => new THREE.Vector3(lx, 0, lz)), true, 'centripetal');
        const shape = new THREE.Shape(curve.getSpacedPoints(64).map((v) => new THREE.Vector2(v.x, -v.z)));
        c.add(new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, y, 0), toon(color)));
      };
      // Pignon en V (toit à deux pans) le long de z, posé à la hauteur y.
      const gable = (w, d, h, cx, y, cz, color) => {
        const tri = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
        c.add(solid(new THREE.ExtrudeGeometry(tri, { depth: d, bevelEnabled: false }).translate(cx, y, cz - d / 2), color, { outlineWidth: 0.1 }));
      };
      return { noTree, plate, flat, parking, lawn, gable };
    };
    // Une école : étiquette, zone (fiche + carte) et rayon de la zone à pied.
    const school = (e, cx, cz, r, ax, ay, az) => {
      labels.push({ pos: new THREE.Vector3(ax, ay + 1.5, az), html: e.school, cls: 'label-place', zone: e.id, hideInZone: true });
      zones.push({
        id: e.id, x: cx, z: cz, r: 0, land: { x: cx, z: cz, r },
        anchor: new THREE.Vector3(ax, ay, az), geo: { ...e.geo, place: e.place, flag: e.flag },
        card: { brand: e.brand, logo: e.logo, kicker: e.dates, title: e.school, sub: e.degree, tags: e.tags, body: e.body, meta: e.place, accent: e.brand.color },
      });
    };
    const [poly, lycee, guelph] = EDUCATION;

    // Polytech Nantes, site de la Chantrerie, d'après la vue aérienne :
    // IRESTE = la longue halle (aile basse en sheds devant), ISITEM = la rotonde derrière, de l'autre côté de la route,
    // IHT = le bâtiment aux voûtes blanches à l'avant ; parkings, pelouses et cheminements entre les bâtiments.
    {
      const px = at.polytech[0], pz = at.polytech[1];
      const c = new THREE.Group();
      c.position.set(px, top, pz);
      g.add(c);
      const white = '#f4f6f8', glass = '#4aa3df', blue = '#2f80c3', pave = '#d9d4c8', grey = '#c3cad3', roofGrey = '#7d8896', asphalt = '#5b6574';
      const wx = x + px, wz = z + pz;
      const { noTree, plate, flat, parking, lawn } = campusKit(c, wx, wz);
      // Côté sud : entre la route nord et la route en anneau, sans déborder sur l'une ni l'autre.
      lawn([[-30, -12], [-12, -13], [16, -13], [27, -9], [26, 6], [14, 15], [2, 25], [-18, 26], [-29, 17], [-32, 2]]);
      // Sol : parvis et cheminements.
      flat(14, 8, -12, 8, pave);                 // parvis devant IRESTE
      flat(3, 12, -18, -10, pave);               // vers la route et la rotonde
      flat(26, 3, 4, 7, pave);                   // allée le long d'IRESTE
      noTree(-12, 4, 9, 8);

      // IRESTE : un long bâtiment, toit plat et une grande verrière à deux pans sur toute sa longueur.
      const IL = 38, IX = 6, IZ = -5;
      c.add(solid(new THREE.BoxGeometry(IL, 7, 12).translate(IX, 3.5, IZ), white, { outlineWidth: 0.16 }));
      for (const y of [2.3, 5.2]) c.add(solid(new THREE.BoxGeometry(IL + 0.3, 1.2, 12.3).translate(IX, y, IZ), glass, { outlineWidth: 0.05 }));
      c.add(solid(new THREE.BoxGeometry(IL + 0.4, 0.5, 12.4).translate(IX, 7.25, IZ), grey, { outlineWidth: 0.08 }));
      // La verrière : un prisme vitré posé dans l'axe, avec ses montants réguliers.
      const VL = IL - 2, VW = 5, VH = 3.6; // longueur, demi-largeur, hauteur du faîtage
      const tri = new THREE.Shape([new THREE.Vector2(-VW, 0), new THREE.Vector2(VW, 0), new THREE.Vector2(0, VH)]);
      const verriere = new THREE.ExtrudeGeometry(tri, { depth: VL, bevelEnabled: false }).rotateY(Math.PI / 2).translate(IX - VL / 2, 7.5, IZ);
      c.add(solid(verriere, '#8fd0f2', { outlineWidth: 0.08 }));
      // Fermes : deux arbalétriers par travée, et le faîtage.
      const slope = Math.atan2(VH, VW), rafter = Math.hypot(VW, VH);
      for (let k = 0; k <= 12; k++) {
        const fx = IX - VL / 2 + k * (VL / 12);
        for (const sd of [-1, 1]) {
          const r = solid(new THREE.BoxGeometry(0.18, 0.18, rafter), grey, { outlineWidth: 0 });
          r.position.set(fx, 7.5 + VH / 2 + 0.05, IZ + (sd * VW) / 2);
          r.rotation.x = sd * slope;
          c.add(r);
        }
      }
      c.add(solid(new THREE.BoxGeometry(VL, 0.22, 0.22).translate(IX, 7.5 + VH + 0.05, IZ), grey, { outlineWidth: 0 }));
      // Entrée vitrée au milieu de la façade sud.
      c.add(solid(new THREE.BoxGeometry(6, 4.6, 2.2).translate(IX, 2.3, IZ + 7), glass, { outlineWidth: 0.08 }));
      c.add(solid(new THREE.BoxGeometry(7, 0.4, 3).translate(IX, 4.8, IZ + 7.2), blue, { outlineWidth: 0.06 }));
      plate('IRESTE', 6, IX + 11, 6.2, IZ + 6.08);
      c.add(sign(poly, 16).translateX(IX).translateZ(IZ));

      // ISITEM : la rotonde ovale derrière IRESTE (de l'autre côté de la route), anneau sombre et toit blanc à facettes.
      const rx = -10, rz = -34;
      c.add(solid(new THREE.CylinderGeometry(8, 8, 6, 24).scale(1.3, 1, 1).translate(rx, 3, rz), white, { outlineWidth: 0.16 }));
      c.add(solid(new THREE.CylinderGeometry(8.08, 8.08, 2.2, 24).scale(1.3, 1, 1).translate(rx, 3.6, rz), '#3b4a5c', { outlineWidth: 0.05 }));
      c.add(solid(new THREE.CylinderGeometry(3.5, 8.6, 3, 8).scale(1.3, 1, 1).rotateY(Math.PI / 8).translate(rx, 7.5, rz), '#fbfcfd', { outlineWidth: 0.1 }));
      c.add(solid(new THREE.CylinderGeometry(3.5, 3.5, 0.6, 8).scale(1.3, 1, 1).translate(rx, 9.2, rz), grey, { outlineWidth: 0.06 }));
      plate('ISITEM', 4.4, rx, 3.6, rz + 8.12);
      // Le petit bâtiment blanc à côté de la rotonde.
      c.add(solid(new THREE.BoxGeometry(8, 9, 8).translate(rx + 18, 4.5, rz - 1), white, { outlineWidth: 0.14 }));
      c.add(solid(new THREE.BoxGeometry(8.2, 0.5, 8.2).translate(rx + 18, 9.2, rz - 1), grey, { outlineWidth: 0.06 }));
      flat(4, 9, rx + 3, rz + 13, pave);  // de la rotonde vers la route
      lawn([[-40, -25], [-8, -25.5], [24, -25], [28, -38], [25, -54], [4, -53], [-20, -48], [-40, -41]]); // côté rotonde et IHT

      // IHT : à gauche, à mi-chemin entre IRESTE et la rotonde, toit en voûtes blanches.
      // En long nord-sud, à gauche d'IRESTE, au bout de la route (qui s'arrête juste avant).
      const HX = -26, HZ = -15, HL = 26;
      lawn([[HX - 8, HZ - 15], [HX + 6, HZ - 16], [HX + 7, HZ + 15], [HX - 8, HZ + 16]]);
      c.add(solid(new THREE.BoxGeometry(10, 4.5, HL).translate(HX, 2.25, HZ), '#eef1f4', { outlineWidth: 0.14 }));
      c.add(solid(new THREE.BoxGeometry(10.2, 1.1, HL + 0.2).translate(HX, 2.6, HZ), glass, { outlineWidth: 0.05 }));
      for (let k = 0; k < 6; k++) {
        // Voûtes transversales, alignées sur toute la longueur.
        const vault = new THREE.CylinderGeometry(2.17, 2.17, 10, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(HX, 4.5, HZ - HL / 2 + 2.17 + k * 4.33);
        c.add(solid(vault, '#fbfcfd', { outlineWidth: 0.07 }));
      }
      plate('IHT', 3.4, HX, 3.6, HZ + HL / 2 + 0.06);

      // Parkings entre les bâtiments, comme sur la photo.
      parking(-6, 17, 5, 1);
      parking(rx + 22, rz - 11, 5, 1);
      // Totem, bancs et arceaux à vélos sur le parvis.
      c.add(solid(new THREE.BoxGeometry(1.2, 3.2, 2.6).translate(-17, 1.6, 6), blue, { outlineWidth: 0.08 }));
      for (const [bx, bz, r] of [[-12, 11, 0], [-7, 11, 0]]) {
        const bench = solid(new THREE.BoxGeometry(2.6, 0.35, 0.8).translate(0, 0.75, 0), PALETTE.wood, { outlineWidth: 0.05 });
        bench.position.set(bx, 0, bz); bench.rotation.y = r; c.add(bench);
      }
      for (let k = 0; k < 4; k++) c.add(solid(new THREE.TorusGeometry(0.55, 0.07, 4, 10, Math.PI).translate(-19.5 - k * 1.1, 0.1, 13.6).rotateY(0), grey, { outlineWidth: 0 }));

      // Collisions, étiquette et zone : la fiche s'ouvre au cœur du campus.
      blocks.boxes.push(
        { x: wx + IX, z: wz + IZ, hx: IL / 2 + 0.3, hz: 6.3 }, { x: wx + IX, z: wz + IZ + 7, hx: 3.2, hz: 1.3 },
        { x: wx + HX, z: wz + HZ, hx: 5.2, hz: HL / 2 + 0.2 }, { x: wx + rx + 18, z: wz + rz - 1, hx: 4.2, hz: 4.2 },
      );
      blocks.circles.push({ x: wx + rx - 3.5, z: wz + rz, r: 7.5 }, { x: wx + rx + 3.5, z: wz + rz, r: 7.5 });
      noTree(rx, rz, 13, 10);
      school(poly, wx - 8, wz - 4, 34, wx + IX, top + 19, wz + IZ);
    }

    // Lycée Amiral Ronarc'h (Brest), d'après la vue aérienne : un bloc à patios, une longue barre plus haute à l'est,
    // le gymnase au toit brun au sud-est, un petit bâtiment au sud ; le parking est au nord, de l'autre côté de la route.
    {
      const lx = at.ronarch[0], lz = at.ronarch[1];
      const c = new THREE.Group();
      c.position.set(lx, top, lz);
      g.add(c);
      const wx = x + lx, wz = z + lz;
      const { noTree, plate, flat, parking, lawn, gable } = campusKit(c, wx, wz);
      const concrete = '#e6e2d8', parapet = '#8d96a3', windows = '#3d5266', pave = '#d9d4c8';
      lawn([[-15, -13], [4, -14], [19, -13], [21, 0], [17, 10], [2, 11], [-14, 10], [-17, -2]]);
      lawn([[-14, -26], [10, -26], [24, -27], [25, -38], [8, -42], [-12, -40]]);
      flat(12, 6, 4, 7, pave); // cour
      flat(3, 6, 2, -18, pave); // vers le parking
      noTree(2, 0, 20, 12);
      // Bloc principal à patios : toit plat, deux patios plantés, lanterneaux.
      c.add(solid(new THREE.BoxGeometry(16, 7, 13).translate(-4, 3.5, -8), concrete, { outlineWidth: 0.16 }));
      for (const y of [2.4, 5.1]) c.add(solid(new THREE.BoxGeometry(16.2, 1, 13.2).translate(-4, y, -8), windows, { outlineWidth: 0.04 }));
      c.add(solid(new THREE.BoxGeometry(16.3, 0.4, 13.3).translate(-4, 7.2, -8), parapet, { outlineWidth: 0.08 }));
      for (const [px2, pz2] of [[-8.5, -10], [-0.5, -6]]) {
        c.add(solid(new THREE.BoxGeometry(4.2, 0.3, 4.2).translate(px2, 7.4, pz2), '#5f7f52', { outlineWidth: 0.05 }));
        c.add(solid(new THREE.IcosahedronGeometry(0.9, 0).translate(px2, 8.2, pz2), '#4f8a3c', { outlineWidth: 0.05 }));
      }
      for (const [sx, sz] of [[-10, -4], [-6, -4], [2, -12], [-2, -12.5]]) c.add(solid(new THREE.BoxGeometry(1.4, 0.6, 1.4).translate(sx, 7.6, sz), '#cfd6e0', { outlineWidth: 0.04 }));
      // Barre est, un étage de plus.
      c.add(solid(new THREE.BoxGeometry(6, 10, 19).translate(8, 5, -5), '#dcd8cf', { outlineWidth: 0.16 }));
      for (const y of [2.4, 5.4, 8.4]) c.add(solid(new THREE.BoxGeometry(6.2, 1, 19.2).translate(8, y, -5), windows, { outlineWidth: 0.04 }));
      c.add(solid(new THREE.BoxGeometry(6.3, 0.4, 19.3).translate(8, 10.2, -5), '#5d6673', { outlineWidth: 0.08 }));
      // Gymnase : toit brun à deux pans.
      c.add(solid(new THREE.BoxGeometry(7, 5, 10).translate(14.7, 2.5, 2), '#d8d0c2', { outlineWidth: 0.14 }));
      gable(7.6, 10.4, 1.8, 14.7, 5, 2, '#8a5a44');
      // Petit bâtiment au sud, abri à vélos à l'ouest.
      c.add(solid(new THREE.BoxGeometry(6, 4, 5).translate(-7, 2, 6.5), concrete, { outlineWidth: 0.12 }));
      c.add(solid(new THREE.BoxGeometry(6.2, 0.4, 5.2).translate(-7, 4.2, 6.5), parapet, { outlineWidth: 0.06 }));
      c.add(solid(new THREE.BoxGeometry(2, 0.25, 7).translate(-14, 2.4, -6), '#9aa3ad', { outlineWidth: 0.05 }));
      for (const pz2 of [-9, -3]) c.add(solid(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 4).translate(-14, 1.2, pz2), '#55607a', { outlineWidth: 0 }));
      plate('RONARC’H', 5, -4, 6, -1.42, 0, '#14275b');
      // Parking au nord, de l'autre côté de la route.
      parking(4, -31, 6, 1);
      c.add(sign(lycee, 16).translateX(-4).translateZ(-8));
      blocks.boxes.push(
        { x: wx - 4, z: wz - 8, hx: 8.2, hz: 6.7 }, { x: wx + 8, z: wz - 5, hx: 3.2, hz: 9.7 },
        { x: wx + 14.7, z: wz + 2, hx: 3.7, hz: 5.2 }, { x: wx - 7, z: wz + 6.5, hx: 3.2, hz: 2.7 },
      );
      school(lycee, wx + 2, wz - 3, 26, wx - 4, top + 17, wz - 8);
    }

    // Guelph Collegiate Vocational Institute (Ontario), d'après la vue aérienne : la longue aile d'origine en brique
    // (et sa tour) à l'ouest, un bloc de liaison, le grand bloc carré à lanterneau à l'est, l'aile basse au sud ;
    // au nord, de l'autre côté de la route, le terrain de sport et le parking. Un coin de Canada sous la neige.
    {
      const gx = at.guelph[0], gz = at.guelph[1];
      const c = new THREE.Group();
      c.position.set(gx, top, gz);
      g.add(c);
      const wx = x + gx, wz = z + gz;
      const { noTree, plate, flat, parking, lawn } = campusKit(c, wx, wz);
      const brick = '#a8483a', brickDark = '#93392d', snow = '#f6fbff', stone = '#e9dccb';
      lawn([[-21, -16], [2, -17], [17, -16], [20, -9], [12, 2], [5, 9], [-6, 11], [-21, 10], [-23, -3]], snow);
      lawn([[-20, -26], [6, -26], [22, -26], [23, -40], [12, -50], [-10, -50], [-21, -42]], snow);
      noTree(-4, -3, 18, 12);
      // Aile ouest d'origine : brique, bandeaux de pierre, toit enneigé.
      c.add(solid(new THREE.BoxGeometry(7, 8, 20).translate(-15, 4, -5), brick, { outlineWidth: 0.16 }));
      for (const y of [2.6, 5.6]) c.add(solid(new THREE.BoxGeometry(7.2, 0.35, 20.2).translate(-15, y, -5), stone, { outlineWidth: 0 }));
      c.add(solid(new THREE.BoxGeometry(7.4, 0.6, 20.4).translate(-15, 8.3, -5), snow, { outlineWidth: 0.08 }));
      for (let k = 0; k < 6; k++) for (const y of [1.6, 4.4, 7]) c.add(solid(new THREE.BoxGeometry(0.2, 1.2, 1.4).translate(-11.4, y, -13 + k * 3.2), '#2d3a4f', { outlineWidth: 0 }));
      // La tour, au bout de l'aile, côté rue : flèche verte et horloge.
      c.add(solid(new THREE.BoxGeometry(4.5, 14, 4.5).translate(-15, 7, 7), brickDark, { outlineWidth: 0.15 }));
      c.add(solid(new THREE.ConeGeometry(3.7, 4.4, 4).rotateY(Math.PI / 4).translate(-15, 16.2, 7), '#3f7d5c', { outlineWidth: 0.12 }));
      c.add(solid(new THREE.CylinderGeometry(1.2, 1.2, 0.3, 12).rotateX(Math.PI / 2).translate(-15, 11, 9.3), '#ffffff', { outlineWidth: 0.05 }));
      // Bloc de liaison.
      c.add(solid(new THREE.BoxGeometry(9, 6, 8).translate(-6.5, 3, -3), '#c9b8a8', { outlineWidth: 0.14 }));
      c.add(solid(new THREE.BoxGeometry(9.3, 0.5, 8.3).translate(-6.5, 6.25, -3), snow, { outlineWidth: 0.06 }));
      // Grand bloc carré à l'est, toit plat et lanterneau central.
      c.add(solid(new THREE.BoxGeometry(13, 7, 13).translate(5.5, 3.5, -8), '#b4594a', { outlineWidth: 0.16 }));
      c.add(solid(new THREE.BoxGeometry(13.3, 0.5, 13.3).translate(5.5, 7.25, -8), snow, { outlineWidth: 0.08 }));
      c.add(solid(new THREE.BoxGeometry(4, 1.8, 4).translate(5.5, 8.4, -8), '#9fb3c4', { outlineWidth: 0.08 }));
      c.add(solid(new THREE.BoxGeometry(4.3, 0.3, 4.3).translate(5.5, 9.45, -8), snow, { outlineWidth: 0.04 }));
      // Aile basse au sud, toit blanc.
      c.add(solid(new THREE.BoxGeometry(8, 4.5, 8).translate(-5, 2.25, 6), '#d9cfc4', { outlineWidth: 0.12 }));
      c.add(solid(new THREE.BoxGeometry(8.3, 0.4, 8.3).translate(-5, 4.65, 6), snow, { outlineWidth: 0.06 }));
      plate('GCVI', 3.4, -5, 3.4, 10.06, 0, '#a8483a');
      // Érables rouges et drapeau devant l'entrée.
      [[-21, 4], [8, 3], [-19, -14]].forEach(([tx, tz], k) => {
        c.add(solid(new THREE.CylinderGeometry(0.3, 0.4, 2.4, 5).translate(tx, 1.2, tz), PALETTE.wood, { outlineWidth: 0.08 }));
        c.add(solid(new THREE.IcosahedronGeometry(2.2 + k * 0.3, 0).translate(tx, 4, tz), k === 1 ? '#e85d2a' : '#d7372b', { outlineWidth: 0.12 }));
      });
      const f = flag('CA', 9);
      f.position.set(2, 0, 8);
      c.add(f);
      f.userData.dynamic = true;
      anim.push((dt, t) => { f.userData.cloth.rotation.y = Math.sin(t * 3) * 0.3; });
      // Au nord : terrain de sport (lignes blanches), losange de baseball et parking.
      flat(22, 13, -7, -35, '#6fae55', 0.07);
      for (const [w, d, cx, cz] of [[22, 0.25, -7, -41.4], [22, 0.25, -7, -28.6], [0.25, 13, -17.9, -35], [0.25, 13, 3.9, -35], [0.25, 13, -7, -35]]) flat(w, d, cx, cz, '#ffffff', 0.09);
      c.add(new THREE.Mesh(new THREE.CircleGeometry(9, 12, 0, Math.PI / 2).rotateX(-Math.PI / 2).rotateY(Math.PI * 0.75).translate(12, 0.08, -38), toon('#d9c49a')));
      noTree(-7, -35, 12, 7);
      noTree(12, -42, 8, 8);
      parking(14, -29, 4, 1);
      c.add(sign(guelph, 17).translateX(-6.5).translateZ(-3));
      blocks.boxes.push(
        { x: wx - 15, z: wz - 5, hx: 3.7, hz: 10.2 }, { x: wx - 15, z: wz + 7, hx: 2.4, hz: 2.4 }, { x: wx - 6.5, z: wz - 3, hx: 4.7, hz: 4.2 },
        { x: wx + 5.5, z: wz - 8, hx: 6.7, hz: 6.7 }, { x: wx - 5, z: wz + 6, hx: 4.2, hz: 4.2 },
      );
      school(guelph, wx - 4, wz - 3, 26, wx - 6.5, top + 17, wz - 3);
    }

  }

  // --- Île Monde : globe et drapeaux des pays où j'ai vécu ou travaillé.
  if (FEATURES.monde) {
    const { x, z, r } = LAYOUT.monde;
    const g = addIsland(x, z, r, 21, { trees: 3, hill: 0 });
    const globeGeo = new THREE.IcosahedronGeometry(7, 1).toNonIndexed();
    const R = rng(4);
    const colors = [];
    const land = new THREE.Color(PALETTE.grass), sea = new THREE.Color('#4a90d9');
    for (let i = 0; i < globeGeo.attributes.position.count; i += 3) {
      const c = R() > 0.62 ? land : sea;
      for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
    }
    globeGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const globe = new THREE.Mesh(globeGeo, toon('#ffffff', { vertexColors: true, flatShading: true }));
    globe.castShadow = true;
    globe.position.y = 12;
    g.add(globe);
    g.add(solid(new THREE.CylinderGeometry(1.2, 2.4, 4, 6).translate(0, 3.6, 0), PALETTE.wood, { outlineWidth: 0.12 }));
    blocks.circles.push({ x, z, r: 3.5 });
    ['FR', 'IT', 'CA'].forEach((c, i) => {
      const f = flag(c, 8);
      const a = 2.2 + i * 0.9;
      f.position.set(Math.cos(a) * 12, 1.8, Math.sin(a) * 12);
      g.add(f);
      anim.push((dt, t) => { f.userData.cloth.rotation.y = Math.sin(t * 3 + i * 2) * 0.3; });
    });
    anim.push((dt, t) => { globe.rotation.y = t * 0.25; });
    labels.push({ pos: new THREE.Vector3(x, 3, z + r + 2), html: 'International', cls: 'label-place' });
    zones.push({
      id: 'monde', x, z, r: r + 30, land: { x, z, r: r + 4 }, anchor: new THREE.Vector3(x, 22, z),
      card: {
        kicker: 'International', title: 'France · Italie · Canada', sub: 'Français natif · anglais (scolarité en Ontario)',
        body: PLACES.map((p) => p.name).join(' · '),
        tags: ['Naples, depuis 2026', 'Ontario, 2018–19'], accent: '#2f9e55',
      },
    });
  }

  // --- Zone perf : un parcours de régate qui accueillera les démos (vue poursuite, réglages, asservissements…).
  if (FEATURES.perf) {
    const markAt = (p, col) => {
      const m = new THREE.Group();
      m.position.set(p.x, 0, p.z);
      m.add(solid(new THREE.CylinderGeometry(1.8, 2.1, 4.2, 10).translate(0, 1.4, 0), col, { outlineWidth: 0.1 }));
      m.add(solid(new THREE.SphereGeometry(1.8, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 3.5, 0), col, { outlineWidth: 0.1 }));
      root.add(m);
      circles.push({ x: p.x, z: p.z, r: 2.6 });
      map.marks.push(p);
      const ph = Math.random() * 6;
      anim.push((dt, t) => { m.position.y = Math.sin(t * 1.4 + ph) * 0.3; });
    };
    markAt(LAYOUT.perf.windward, '#ffc845');
    LAYOUT.perf.gate.forEach((p) => markAt(p, '#ffc845'));
    labels.push({ pos: new THREE.Vector3(LAYOUT.perf.windward.x, 10, LAYOUT.perf.windward.z), html: 'Marque au vent', cls: 'label-hint' });
    labels.push({ pos: new THREE.Vector3(40, 6, -130), html: 'Zone perf', cls: 'label-place' });
    zones.push({
      id: 'perf', x: 40, z: -185, r: 75, anchor: new THREE.Vector3(40, 8, -130), look: { x: 40, z: -200 }, zoom: 1.4,
      card: {
        kicker: 'Zone perf', title: 'Le terrain de jeu de l’ingénieur perf', sub: 'En construction',
        body: 'Ici viendront les démos : vue poursuite, correction des réglages par analyse, différents asservissements du vol, et une visualisation des gradients pour trouver la manœuvre optimale.',
        tags: ['Simulation', 'Contrôle', 'Optimisation'], accent: '#ffc845',
      },
    });
  }

  // --- Le port : quai, digue, Café des Agents, piste et salle de muscu.
  // Construit à ses coordonnées d'origine, puis rapproché d'un bloc par shiftSince().
  const harbourStart = snapshot();
  {
    const q = LAYOUT.quay;
    // L'île du port : littoral organique ; seul le quai qui borde le bassin reste droit.
    const ISLAND = [
      [292, -268], [360, -268], [420, -268], [490, -268], [548, -268], [574, -296], [592, -348], [583, -406],
      [556, -452], [502, -474], [440, -486], [382, -468], [322, -481], [262, -472], [214, -456], [186, -420],
      [166, -376], [163, -334], [178, -298], [212, -276], [252, -267],
    ];
    portIsland = buildIsland({
      root, anim, land, ctrl: ISLAND, top: 1.6, S: 2.4,
      corniche: (x, z) => !(z > -300 && x > 240 && x < 575), // tout le tour, sauf le quai du bassin
    });
    const qTop = 1.6;

    // Digue en enrochement : deux bras qui ferment le bassin au sud, entrée entre x≈380 et x≈460.
    const R = rng(99);
    const rocks = [];
    const arm = (pts) => {
      for (let i = 0; i < pts.length - 1; i++) segs.push([...pts[i], ...pts[i + 1]]);
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
        const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 6);
        for (let k = 0; k <= n; k++) {
          const x = THREE.MathUtils.lerp(ax, bx, k / n), z = THREE.MathUtils.lerp(az, bz, k / n);
          const s = 3.2 + R() * 1.6;
          rocks.push(new THREE.IcosahedronGeometry(s, 0).rotateY(R() * 6).translate(x, 0.6, z));
          circles.push({ x, z, r: s + 0.5 });
        }
      }
    };
    arm([[292, -266], [292, -190], [372, -178]]);
    arm([[548, -266], [548, -190], [466, -178]]);
    root.add(solid(mergeGeometries(rocks), PALETTE.rock, { outlineWidth: 0.2 }));
    const light = (x, z, col) => {
      const l = new THREE.Group();
      l.position.set(x, 0, z);
      l.add(solid(new THREE.CylinderGeometry(1.4, 1.9, 10, 8).translate(0, 5, 0), '#ffffff', { outlineWidth: 0.12 }));
      l.add(solid(new THREE.CylinderGeometry(1.5, 1.5, 2.2, 8).translate(0, 6, 0), col, { outlineWidth: 0 }));
      l.add(solid(new THREE.ConeGeometry(1.7, 2.2, 8).translate(0, 11.1, 0), col, { outlineWidth: 0.12 }));
      root.add(l);
    };
    light(374, -178, '#e8404a');
    light(464, -178, '#2f9e55');

    // Ponton.
    root.add(solid(new THREE.BoxGeometry(5, 1, 46).translate(420, 0.6, q.z + q.hz + 23), PALETTE.wood, { outlineWidth: 0.1 }));
    boxes.push({ x: 420, z: q.z + q.hz + 23, hx: 3, hz: 23 });
    land.boxes.push({ x: 420, z: q.z + q.hz + 23, hx: 2.5, hz: 23, y: 1.1 });
    map.boxes.push({ x: 420, z: q.z + q.hz + 23, hx: 2.5, hz: 23 });

    const S = 2.4; // personnages agrandis pour rester lisibles depuis la caméra haute

    // Campus : les écoles, au nord du quai.
    buildCampus(380, -412, qTop, { polytech: [-48, 0], ronarch: [-8, 0], guelph: [32, 2] });
    labels.push({ pos: new THREE.Vector3(380, 4, -392), html: '🎓 Formation', cls: 'label-place' });

    // K-Challenge : mon poste actuel, au bord de l'eau, avec un foiler amarré devant.
    {
      const kc = EXPERIENCES[kcIndex];
      const b = new THREE.Group();
      b.position.set(470, qTop, -290);
      b.add(solid(new THREE.BoxGeometry(26, 11, 12).translate(0, 5.5, 0), '#14275b', { outlineWidth: 0.18 }));
      b.add(solid(new THREE.BoxGeometry(26.4, 3, 12.4).translate(0, 6.5, 0), '#4aa3df', { outlineWidth: 0.1 }));
      b.add(solid(new THREE.BoxGeometry(27, 0.8, 13).translate(0, 11.4, 0), '#e8404a', { outlineWidth: 0.1 }));
      b.add(solid(new THREE.BoxGeometry(9, 7, 0.5).translate(0, 3.5, 6.2), '#f6f1e7', { outlineWidth: 0.08 }));
      const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture(kc), depthWrite: false }));
      sign.scale.setScalar(8);
      sign.position.y = 17;
      b.add(sign);
      root.add(b);
      blocks.boxes.push({ x: 470, z: -290, hx: 13.5, hz: 6.5 });
      const moored = new Boat();
      moored.pos.set(525, -240);
      moored.heading = -Math.PI / 2;
      moored.update(0.016, { steer: 0, power: 0, brake: true }, null);
      moored.root.position.y = -0.2;
      root.add(moored.root);
      circles.push({ x: 525, z: -240, r: 7 });
      labels.push({ pos: new THREE.Vector3(470, qTop + 24, -290), html: `<i>Emploi actuel</i>${kc.org}`, cls: 'label-buoy k-job', zone: 'kc', hideInZone: true });
      zones.push({
        id: 'kc', x: 520, z: -210, r: 30, zoom: 1.1, land: { x: 470, z: -285, r: 22 },
        anchor: new THREE.Vector3(520, 12, -225), geo: { ...kc.geo, place: kc.place, flag: kc.flag },
        card: {
          brand: kc.brand, logo: kc.logo, kicker: `Emploi actuel · ${kc.year}`, title: kc.org, sub: kc.role, tags: kc.tags, body: kc.body,
          meta: [kc.dates, kc.place].filter(Boolean).join(' · '), accent: PALETTE.job,
        },
      });
      map.buoys.push({ x: kcBerth.x, z: kcBerth.z, color: kc.brand.color }); // la carte n'est pas déplacée avec le port : coordonnées finales
    }

    // Immeuble de bureaux de l'open space des agents (construit puis déplacé d'un bloc au nord-est du quai,
    // pour ne pas être sur le passage en sortant du ponton).
    const openSpaceStart = snapshot();
    const office = new THREE.Group();
    office.position.set(355, qTop, -306);
    office.add(solid(new THREE.BoxGeometry(34, 12, 18).translate(0, 6, 0), '#eef1f4', { outlineWidth: 0.2 }));
    office.add(solid(new THREE.BoxGeometry(34.4, 3, 18.4).translate(0, 7.5, 0), '#4aa3df', { outlineWidth: 0.12 }));
    office.add(solid(new THREE.BoxGeometry(34.4, 2.4, 18.4).translate(0, 2.8, 0), '#4aa3df', { outlineWidth: 0.12 }));
    office.add(solid(new THREE.BoxGeometry(35, 0.8, 19).translate(0, 12.4, 0), '#3c4a5c', { outlineWidth: 0.12 }));
    office.add(solid(new THREE.BoxGeometry(6, 3, 5).translate(9, 14.3, -2), '#9aa3ad', { outlineWidth: 0.1 }));
    office.add(solid(new THREE.BoxGeometry(5, 5, 0.4).translate(0, 2.5, 9.1), '#26324a', { outlineWidth: 0.08 }));
    root.add(office);
    blocks.boxes.push({ x: 355, z: -306, hx: 17.5, hz: 9.5 });
    labels.push({ pos: new THREE.Vector3(355, 26, -306), html: '🏢 Open space des agents', cls: 'label-place' });

    cafeLoop = buildCafe({ root, anim, labels, blocks, qTop, S });
    zones.push({ id: 'agents', x: 383, z: -284, r: 0, land: { x: 383, z: -284, r: 44 }, anchor: new THREE.Vector3(355, 21, -316), zoom: 1.05, look: { x: 360, z: -284 }, live: true, walkZoom: 1.45, cardSide: true, card: { ...AI_FLOW, accent: '#3ec7c2' } });

    shiftSince(openSpaceStart, 113, -108);

    // La ville : quartier, route et voitures, passants, capitainerie, marina.
    buildTown({ root, anim, labels, circles, blocks, land, qTop, S });

    // La cathédrale, au bord de l'eau sur la côte ouest (simple décor).
    {
      const c = new THREE.Group();
      c.position.set(193, 1.85, -345);
      c.rotation.y = -Math.PI / 2; // façade et clochers tournés vers la mer, comme la Seu de Palma
      const stone = '#e3c590';
      c.add(solid(new THREE.BoxGeometry(11, 12, 28).translate(0, 6, 0), stone, { outlineWidth: 0.15 }));
      c.add(solid(new THREE.CylinderGeometry(0, 8.2, 5, 4, 1).rotateY(Math.PI / 4).scale(0.95, 1, 2.45).translate(0, 14.5, 0), '#c9a66b', { outlineWidth: 0.12 }));
      c.add(solid(new THREE.CylinderGeometry(5.5, 5.5, 10, 10, 1, false, 0, Math.PI).rotateY(Math.PI / 2).translate(0, 5, -14), stone, { outlineWidth: 0.12 }));
      for (const s of [-1, 1]) {
        c.add(solid(new THREE.BoxGeometry(4.5, 22, 4.5).translate(s * 4.5, 11, 15), stone, { outlineWidth: 0.12 }));
        c.add(solid(new THREE.ConeGeometry(3.4, 5, 4).rotateY(Math.PI / 4).translate(s * 4.5, 24.5, 15), '#c9a66b', { outlineWidth: 0.1 }));
        for (let k = -2; k <= 2; k++) c.add(solid(new THREE.BoxGeometry(1.4, 9, 2).translate(s * 6.2, 4.5, k * 5.5), stone, { outlineWidth: 0.06 }));
      }
      c.add(solid(new THREE.CylinderGeometry(2.2, 2.2, 0.3, 14).rotateX(Math.PI / 2).translate(0, 8.5, 14.2), '#4aa3df', { outlineWidth: 0.05 }));
      root.add(c);
      blocks.circles.push({ x: 193, z: -345, r: 15 });
    }

    // Course à pied : les joggeurs de la corniche.
    {
      const c = portIsland.corniche;
      const mid = c[Math.floor(c.length * 0.45)];
      labels.push({ pos: new THREE.Vector3(mid.x, 10, mid.z), html: '🏃 Course à pied', cls: 'label-place', zone: 'run', hideInZone: true });
      zones.push({ id: 'run', x: mid.x, z: mid.z, r: 0, land: { x: mid.x, z: mid.z, r: 40 }, anchor: new THREE.Vector3(mid.x, 9, mid.z), look: { x: mid.x, z: mid.z }, card: { ...INTERESTS.run, accent: '#d9734e' } });
    }

    // Musculation : une aire de calisthénie bien à l'intérieur du parc (sol amortissant, barres, échelle, barres parallèles).
    const GYM = { x: 365, z: -362 };
    const gym = new THREE.Group();
    gym.position.set(GYM.x, qTop, GYM.z);
    gym.add(solid(new THREE.BoxGeometry(22, 0.3, 14).translate(0, 0.15, 0), '#2f6b5a', { outlineWidth: 0.08 }));
    const steel = '#55607a', bar = '#cfd6e0';
    const post = (x, z, h) => gym.add(solid(new THREE.CylinderGeometry(0.22, 0.22, h, 6).translate(x, h / 2, z), steel, { outlineWidth: 0.04 }));
    const rail = (x0, x1, y, z) => gym.add(solid(new THREE.CylinderGeometry(0.12, 0.12, Math.abs(x1 - x0), 6).rotateZ(Math.PI / 2).translate((x0 + x1) / 2, y, z), bar, { outlineWidth: 0.03 }));
    // Barres de traction à trois hauteurs.
    post(-9, -4, 7.4); post(-4, -4, 7.4); post(1, -4, 6.4); post(6, -4, 5.4);
    rail(-9, -4, 7.2, -4); rail(-4, 1, 6.2, -4); rail(1, 6, 5.2, -4);
    // Échelle horizontale (monkey bars).
    post(-9, 3, 6.8); post(-1, 3, 6.8); post(-9, 5, 6.8); post(-1, 5, 6.8);
    for (const z of [3, 5]) rail(-9, -1, 6.6, z);
    for (let k = 0; k < 7; k++) gym.add(solid(new THREE.CylinderGeometry(0.1, 0.1, 2, 5).rotateX(Math.PI / 2).translate(-8.4 + k * 1.2, 6.6, 4), bar, { outlineWidth: 0 }));
    // Barres parallèles pour les dips.
    for (const z of [2.6, 4.6]) { post(4, z, 3.2); post(8.5, z, 3.2); rail(4, 8.5, 3.1, z); }
    // Les athlètes : tractions et dips.
    const puller = person({ shirt: '#4d7cff' });
    puller.scale.setScalar(S * 0.9);
    puller.userData.arms.forEach((a) => { a.rotation.x = Math.PI; });
    gym.add(puller);
    const dipper = person({ shirt: '#2f9e55' });
    dipper.scale.setScalar(S * 0.85);
    dipper.userData.arms.forEach((a) => { a.rotation.x = 0.15; });
    dipper.userData.legs.forEach((l) => { l.rotation.x = 0.9; });
    gym.add(dipper);
    root.add(gym);
    blocks.boxes.push({ x: GYM.x, z: GYM.z, hx: 11.5, hz: 7.5 });
    anim.push((dt, t) => {
      const k = (Math.sin(t * 2.6) + 1) / 2; // tractions
      puller.position.set(-6.5, 1.2 + k * 1.7, -4);
      const d = (Math.sin(t * 3.1 + 1) + 1) / 2; // dips
      dipper.position.set(6.25, 0.9 + d * 1.1, 3.6);
      dipper.rotation.y = Math.PI / 2;
    });
    labels.push({ pos: new THREE.Vector3(GYM.x, 14, GYM.z), html: '🏋️ Musculation', cls: 'label-place', zone: 'gym', hideInZone: true });
    zones.push({ id: 'gym', x: GYM.x, z: GYM.z, r: 0, land: { x: GYM.x, z: GYM.z, r: 20 }, bar: { dx: -1.5, dz: -4, y: qTop + 6.2 }, anchor: new THREE.Vector3(GYM.x, 12, GYM.z), zoom: 0.9, look: { x: GYM.x, z: GYM.z }, card: { ...INTERESTS.gym, accent: '#2f9e55' } });

    zones.push({
      id: 'port', x: 420, z: -230, r: 45, land: { x: 420, z: -238, r: 16 }, anchor: new THREE.Vector3(420, 10, -262), zoom: 1.1, look: { x: 420, z: -290 },
      card: { kicker: 'Arrivée', title: 'Bienvenue sur l’île', sub: 'Merci d’avoir navigué jusqu’ici', body: 'Débarque pour explorer l’île : formation, emploi actuel, compétences et centres d’intérêt t’attendent à terre.', accent: PALETTE.accent, land: true },
    });

    // Collines : un peu de relief au nord-est et à l'ouest de l'île (on peut y monter à pied).
    for (const hl of [{ x: 512, z: -452, r: 26, h: 7 }, { x: 240, z: -455, r: 20, h: 5 }]) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 7, 0, Math.PI * 2, 0, Math.PI / 2), toon(PALETTE.grass, { flatShading: true }));
      dome.scale.set(hl.r, hl.h, hl.r);
      dome.position.set(hl.x, qTop - 0.2, hl.z);
      dome.receiveShadow = dome.castShadow = true;
      root.add(dome);
      land.hills.push({ ...hl, y: qTop });
    }

    // La vie de l'île : plage, parc, supermarché, immeubles, tour, entrepôts, arbres.
    const life = buildIslandLife({ root, anim, blocks, circles, poly: portIsland.poly, top: qTop, S, hills: land.hills });
    map.roads.push(...life.roads);
  }

  shiftSince(harbourStart, HARBOUR_SHIFT.x, HARBOUR_SHIFT.z);

  // --- Le Phare des maîtrises, relié aux lieux où la donnée travaille.
  const zoneAt = (id) => zones.find((z) => z.id === id);
  const phare = buildPhare({
    root, anim, labels, circles, map, zones, at: LAYOUT.phare,
    links: [zoneAt('agents').land, { x: LAYOUT.title.x, z: LAYOUT.title.z + 22 }, zoneAt('kc')],
  });

  // --- Naples : en approchant de la dernière bouée, la mer vire au turquoise et le Vésuve apparaît.
  const tints = [{ x: kcBerth.x - 20, z: kcBerth.z + 50, r: 110, color: '#29c3c9' }];
  {
    const vx = kcBerth.x + 135, vz = kcBerth.z + 20;
    const v = new THREE.Group();
    v.position.set(vx, 0, vz);
    v.add(solid(wobble(new THREE.CylinderGeometry(30, 33, 2.6, 12).translate(0, -0.7, 0), 3), '#e9d2a2', { outlineWidth: 0.25 }));
    v.add(solid(wobble(new THREE.CylinderGeometry(7, 25, 20, 10, 2).translate(0, 10.3, 0), 5, 0.6), '#7d6a5c', { outlineWidth: 0.25 }));
    v.add(solid(new THREE.CylinderGeometry(5.5, 7, 1.2, 10).translate(0, 20.6, 0), '#4a3f38', { outlineWidth: 0.12 }));
    for (let k = 0; k < 5; k++) {
      const a = k * 1.3;
      v.add(solid(new THREE.ConeGeometry(1.4, 4, 5).translate(Math.cos(a) * 24, 3, Math.sin(a) * 24), '#4f8f4a', { outlineWidth: 0.1 }));
    }
    const puffs = [];
    for (let k = 0; k < 6; k++) {
      const p = solid(new THREE.IcosahedronGeometry(2.2, 0), '#f2efe9', { outlineWidth: 0.08, cast: false });
      v.add(p);
      puffs.push(p);
    }
    anim.push((dt, t) => puffs.forEach((p, k) => {
      const u = (t * 0.12 + k / puffs.length) % 1;
      p.position.set(Math.sin(u * 4 + k) * 2 + u * 9, 22 + u * 22, Math.cos(u * 3 + k) * 1.5);
      p.scale.setScalar(0.6 + u * 1.8);
    }));
    root.add(v);
    circles.push({ x: vx, z: vz, r: 31 });
    map.islands.push({ x: vx, z: vz, r: 30 });
    labels.push({ pos: new THREE.Vector3(vx, 3, vz + 33), html: 'Vesuvio', cls: 'label-place' });
  }

  // Îlots décoratifs.
  [[40, 235, 14, 3], [150, 215, 18, 5], [-320, -130, 24, 9], [-200, -190, 22, 13], [-80, 310, 16, 19]]
    .forEach(([x, z, r, s]) => addIsland(x, z, r, s, { trees: Math.round(r / 5), hill: r > 20 ? 1 : 0 }));

  // --- Habillage : balisage latéral du chenal, cardinales, dangers isolés, bateaux PNJ.
  {
    const raceC = { x: committeeAt.x + 22, z: committeeAt.z - 30 };
    const decor = buildDecor({
      root, anim, circles, chenal,
      skipSegments: [1, 2, chenal.length - 2], // pas de balises dans le match race ni dans le bassin
      avoid: [
        ...chenal.map((p) => ({ x: p.x, z: p.z, r: 22 })),
        { x: raceC.x, z: raceC.z, r: 62 },
        { x: LAYOUT.phare.x, z: LAYOUT.phare.z, r: 26 },
        ...map.islands.map((i) => ({ x: i.x, z: i.z, r: i.r + 8 })),
      ],
      cardinals: [{ x: 150, z: 185, dir: 'N' }, { x: 8, z: 235, dir: 'W' }, { x: -168, z: -190, dir: 'E' }],
      dangers: [{ x: 370, z: 85 }, { x: -60, z: 190 }],
    });
    decor.cruise(decor.fishingBoat(), [[220, 200], [300, 165], [335, 230], [265, 285], [185, 262]], 70);
  }

  const shores = [
    ...map.islands,
    ...map.buoys.map((b) => ({ x: b.x, z: b.z, r: -2.4 })),
    ...map.marks.map((m) => ({ x: m.x, z: m.z, r: -2.2 })),
  ];
  const water = makeWater(shores, boxes, segs, tints, portIsland.poly.pts.filter((_, i) => i % 2 === 0));
  scene.add(water.group);

  // --- Régions (mode carte du monde façon JRPG) : hors de ces zones, la caméra montre toute la carte.
  const harbourC = { x: LAYOUT.quay.x + HARBOUR_SHIFT.x, z: -330 + HARBOUR_SHIFT.z };
  const isleP = portIsland.poly.pts;
  const isleB = { x0: Math.min(...isleP.map((p) => p.x)), x1: Math.max(...isleP.map((p) => p.x)), z0: Math.min(...isleP.map((p) => p.y)) };
  const regions = [
    { id: 'parcours', name: 'Mon parcours', circle: [0, 0, 0], at: [150, 120] },
    // Vue rapprochée seulement autour de chaque étape du parcours (et du comité SHN).
    ...chenal.slice(0, -3).map((p) => ({ circle: [p.x, p.z, 30] })),
    { id: 'port', rect: [isleB.x0 - 20, isleB.z0 - 20, isleB.x1 + 20, -125], at: [harbourC.x, harbourC.z - 10] },
    { id: 'phare', name: 'Le Phare des maîtrises', circle: [LAYOUT.phare.x, LAYOUT.phare.z, 72], at: [LAYOUT.phare.x, LAYOUT.phare.z] },
  ];
  for (const r of regions.filter((r) => r.name)) labels.push({ pos: new THREE.Vector3(r.at[0], 30, r.at[1]), html: r.name, cls: 'label-region', overworld: true });
  const inside = (r, p) => (r.rect
    ? p.x >= r.rect[0] && p.x <= r.rect[2] && p.y >= r.rect[1] && p.y <= r.rect[3]
    : Math.hypot(p.x - r.circle[0], p.y - r.circle[1]) <= r.circle[2]);
  const inRegion = (p) => regions.some((r) => inside(r, p));
  const inPort = (p) => inside(regions.find((r) => r.id === 'port'), p);

  const BOUND = 560;
  function collide(pos, radius) {
    let hit = false;
    for (const p of land.polys) {
      const q = nearestOnPoly(p.pts, pos.x, pos.y);
      const inside = insidePoly(p.pts, pos.x, pos.y);
      if (inside || q.d < radius) {
        const dx = (pos.x - q.x) * (inside ? -1 : 1), dz = (pos.y - q.z) * (inside ? -1 : 1), d = Math.hypot(dx, dz) || 1;
        pos.x = q.x + (dx / d) * radius;
        pos.y = q.z + (dz / d) * radius;
        hit = true;
      }
    }
    for (const c of circles) {
      const dx = pos.x - c.x, dz = pos.y - c.z;
      const d = Math.hypot(dx, dz), min = c.r + radius;
      if (d < min && d > 1e-4) { pos.x = c.x + (dx / d) * min; pos.y = c.z + (dz / d) * min; hit = true; }
    }
    for (const b of boxes) {
      const qx = THREE.MathUtils.clamp(pos.x, b.x - b.hx, b.x + b.hx);
      const qz = THREE.MathUtils.clamp(pos.y, b.z - b.hz, b.z + b.hz);
      const dx = pos.x - qx, dz = pos.y - qz, d = Math.hypot(dx, dz);
      if (d < radius) {
        if (d > 1e-4) { pos.x = qx + (dx / d) * radius; pos.y = qz + (dz / d) * radius; }
        else pos.y = b.z + b.hz + radius;
        hit = true;
      }
    }
    const r = Math.hypot(pos.x, pos.y);
    if (r > BOUND) { pos.multiplyScalar(BOUND / r); hit = true; }
    return hit;
  }

  function update(dt, t, boat) {
    water.update(t);
    for (const fn of anim) fn(dt, t);
    for (const L of letters) {
      const dx = L.p.x - boat.pos.x, dz = L.p.y - boat.pos.y;
      const d = Math.hypot(dx, dz);
      const R = cell * 4.3;
      if (d < R && d > 1e-3) {
        const push = (R - d) / R;
        L.v.x += (dx / d) * push * (4 + boat.speed * 1.2);
        L.v.y += (dz / d) * push * (4 + boat.speed * 1.2);
        L.w += (Math.random() - 0.5) * push * 6;
      }
      L.v.x += (L.home.x - L.p.x) * 0.35 * dt;
      L.v.y += (L.home.y - L.p.y) * 0.35 * dt;
      L.v.multiplyScalar(Math.pow(0.35, dt));
      L.w += -L.rot * 0.6 * dt;
      L.w *= Math.pow(0.3, dt);
      L.rot += L.w * dt;
      L.p.addScaledVector(L.v, dt);
      L.g.position.set(L.p.x, 0.3 + Math.sin(t * 1.3 + L.phase) * 0.15, L.p.y);
      L.g.rotation.y = L.rot;
      L.g.rotation.z = Math.sin(t * 0.9 + L.phase) * 0.03;
    }
  }

  // Hauteur du sol à terre, ou null si (x, z) est dans l'eau.
  function groundY(x, z) {
    // Collines : sol bombé, on y monte en douceur.
    for (const hl of land.hills) {
      const k = Math.hypot(x - hl.x, z - hl.z) / hl.r;
      if (k < 1) return hl.y + hl.h * Math.sqrt(1 - k * k) - 0.2;
    }
    for (const p of land.polys) if (insidePoly(p.pts, x, z)) return p.y;
    for (const b of land.boxes) if (Math.abs(x - b.x) <= b.hx && Math.abs(z - b.z) <= b.hz) return b.y;
    for (const c of land.circles) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d <= c.r) return d <= c.rTop ? c.yTop : c.y;
    }
    return null;
  }
  // Point où un marin peut se tenir : sur la terre et hors des bâtiments.
  function walkable(x, z, radius = 1) {
    if (groundY(x, z) === null) return false;
    for (const c of blocks.circles) if (Math.hypot(x - c.x, z - c.z) < c.r + radius) return false;
    for (const b of blocks.boxes) if (Math.abs(x - b.x) < b.hx + radius && Math.abs(z - b.z) < b.hz + radius) return false;
    return true;
  }
  // Point de débarquement le plus proche autour du bateau.
  function landingSpot(x, z, maxR = 24) {
    // D'abord le rivage le plus proche de l'île, puis quelques pas vers l'intérieur.
    for (const p of land.polys) {
      const q = nearestOnPoly(p.pts, x, z);
      if (q.d > maxR) continue;
      const inside = insidePoly(p.pts, x, z);
      const dx = (q.x - x) * (inside ? -1 : 1), dz = (q.z - z) * (inside ? -1 : 1), l = Math.hypot(dx, dz) || 1;
      for (const step of [3, 5, 8, 12, 16]) {
        for (const side of [0, -6, 6, -12, 12]) {
          const px = q.x + (dx / l) * step - (dz / l) * side, pz = q.z + (dz / l) * step + (dx / l) * side;
          if (walkable(px, pz, 1.5)) return new THREE.Vector2(px, pz);
        }
      }
    }
    maxR = Math.min(maxR, 24);
    for (let r = 3; r <= maxR; r += 1.5) {
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (walkable(px, pz, 1.5)) return new THREE.Vector2(px, pz);
      }
    }
    return null;
  }

  const addObstacle = (c) => circles.push(c);
  return { berth: kcBerth, islandPoly: () => portIsland?.poly.pts, zones, labels, collide, update, map, bound: BOUND, groundY, walkable, landingSpot, cafe: cafeLoop, phare, regions, inRegion, inPort, water, addObstacle };
}
