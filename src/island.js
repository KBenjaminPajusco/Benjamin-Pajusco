import * as THREE from 'three';
import { solid, toon } from './toon.js?v=20261008155007';
import { person } from './characters.js?v=20261008155007';

// L'île du port : un littoral organique (courbe fermée) au lieu d'un quai rectangulaire,
// une corniche en bord de mer avec ses joggeurs et ses lampadaires.

export const LAMP = {
  bulb: new THREE.MeshBasicMaterial({ color: '#fff4d6' }),
  glow: new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffd48a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
};

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const navGlow = (color) => new THREE.SpriteMaterial({ map: LAMP.glow.map, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
export const NAV = { red: navGlow('#ff4a4a'), green: navGlow('#4dff8a'), white: navGlow('#fff6e0') };

// Ajoute les feux de navigation à un bateau (coordonnées locales : +x = bâbord, +z = avant).
export function navLights(parent, { port, starboard, mast, size = 3 }) {
  for (const [mat, p] of [[NAV.red, port], [NAV.green, starboard], [NAV.white, mast]]) {
    if (!p) continue;
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(size);
    s.position.set(...p);
    parent.add(s);
  }
}

export function lampPost(top) {
  const g = new THREE.Group();
  g.add(solid(new THREE.CylinderGeometry(0.14, 0.2, 6.5, 5).translate(0, top + 3.25, 0), '#3c4a5c', { outlineWidth: 0.03 }));
  g.add(solid(new THREE.BoxGeometry(0.12, 0.12, 1.4).translate(0, top + 6.4, 0.6), '#3c4a5c', { outlineWidth: 0 }));
  g.add(solid(new THREE.BoxGeometry(0.8, 0.35, 0.8).translate(0, top + 6.4, 1.3), '#3c4a5c', { outlineWidth: 0.02 }));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), LAMP.bulb);
  bulb.position.set(0, top + 6.1, 1.3);
  g.add(bulb);
  const glow = new THREE.Sprite(LAMP.glow);
  glow.scale.setScalar(7);
  glow.position.set(0, top + 6, 1.3);
  g.add(glow);
  return g;
}

// Aire signée : sert à savoir de quel côté se trouve l'intérieur de l'île.
function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function buildIsland({ root, anim, land, ctrl, top, S, corniche }) {
  const curve = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  const pts = curve.getSpacedPoints(180).slice(0, -1).map((v) => new THREE.Vector2(v.x, v.z));
  const poly = { pts, y: top };
  land.polys.push(poly);

  // Terre : forme extrudée (x, -z) puis couchée à plat, dessus à `top`.
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 3.2, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2).translate(0, top - 3.2, 0);
  const ground = solid(geo, '#dccfb4', { outlineWidth: 0.3 });
  root.add(ground);

  // Corniche : un liseré piétonnier à quelques mètres du rivage, sur la portion demandée du littoral.
  const inward = signedArea(pts) > 0 ? -1 : 1; // sens de la normale vers l'intérieur
  const n = pts.length;
  // Plus longue portion continue du littoral qui satisfait le filtre (ex. hors du bassin du port).
  const ok = pts.map((p) => corniche(p.x, p.y));
  let bestStart = 0, bestLen = 0;
  for (let i = 0; i < n; i++) {
    if (!ok[i] || ok[(i - 1 + n) % n]) continue;
    let len = 0;
    while (len < n && ok[(i + len) % n]) len++;
    if (len > bestLen) { bestLen = len; bestStart = i; }
  }
  const path = [];
  for (let i = bestStart + 2; i <= bestStart + bestLen - 3; i++) {
    const p = pts[i % n], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const tx = b.x - a.x, tz = b.y - a.y, l = Math.hypot(tx, tz);
    const nx = (-tz / l) * inward, nz = (tx / l) * inward;
    path.push({ x: p.x + nx * 8, z: p.y + nz * 8, nx, nz });
  }
  const pos = [], idx = [];
  path.forEach((p, i) => {
    pos.push(p.x - p.nx * 2.6, top + 0.07, p.z - p.nz * 2.6, p.x + p.nx * 2.6, top + 0.07, p.z + p.nz * 2.6);
    if (i < path.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  });
  const walkGeo = new THREE.BufferGeometry();
  walkGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  walkGeo.setIndex(idx);
  walkGeo.computeVertexNormals();
  const walk = new THREE.Mesh(walkGeo, toon('#f3ead8', { side: THREE.DoubleSide }));
  walk.receiveShadow = true;
  root.add(walk);

  // Lampadaires côté mer, tous les quelques mètres.
  for (let i = 0; i < path.length; i += 5) {
    const p = path[i];
    const l = lampPost(top);
    l.position.set(p.x - p.nx * 4, 0, p.z - p.nz * 4);
    l.rotation.y = Math.atan2(p.nx, p.nz); // la lanterne penche vers la promenade
    root.add(l);
  }

  return { poly, corniche: path };
}

// Outils géométriques sur le littoral.
export function insidePoly(pts, x, z) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > z) !== (b.y > z) && x < ((b.x - a.x) * (z - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
export function nearestOnPoly(pts, x, z) {
  let best = null, bd = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const abx = b.x - a.x, abz = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.y) * abz) / (abx * abx + abz * abz)));
    const px = a.x + abx * t, pz = a.y + abz * t, d = Math.hypot(x - px, z - pz);
    if (d < bd) { bd = d; best = { x: px, z: pz, d }; }
  }
  return best;
}
