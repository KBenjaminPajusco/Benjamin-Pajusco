import * as THREE from 'three';
import { solid, rng } from './toon.js?v=20261008154817';
import { keelboat } from './matchrace.js?v=20261008154817';

// Habillage du plan d'eau : balisage latéral (IALA A), cardinales, danger isolé, bateaux PNJ.

const RED = '#d7372b', GREEN = '#2f9e55', YELLOW = '#ffc845', BLACK = '#1d2533';

function bob(anim, g, seed) {
  anim.push((dt, t) => {
    g.position.y = Math.sin(t * 1.5 + seed) * 0.2;
    g.rotation.z = Math.sin(t * 1.1 + seed) * 0.06;
  });
}

// Bouée latérale : rouge à bâbord (cylindre), verte à tribord (cône) en remontant vers le port.
function lateral(side) {
  const g = new THREE.Group();
  const col = side === 'port' ? RED : GREEN;
  g.add(solid(new THREE.CylinderGeometry(0.9, 1.1, 1.4, 8).translate(0, 0.4, 0), col, { outlineWidth: 0.05 }));
  g.add(solid(new THREE.CylinderGeometry(0.35, 0.45, 2.4, 6).translate(0, 2.2, 0), col, { outlineWidth: 0.04 }));
  g.add(side === 'port'
    ? solid(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 8).translate(0, 3.9, 0), col, { outlineWidth: 0.04 })
    : solid(new THREE.ConeGeometry(0.65, 1.1, 8).translate(0, 4.0, 0), col, { outlineWidth: 0.04 }));
  g.scale.setScalar(1.6);
  return g;
}

// Cardinale : pilier noir et jaune, deux cônes dont l'orientation indique le côté sûr.
const CARDINAL = {
  N: { bands: [BLACK, YELLOW], cones: ['up', 'up'] },
  S: { bands: [YELLOW, BLACK], cones: ['down', 'down'] },
  E: { bands: [BLACK, YELLOW, BLACK], cones: ['up', 'down'] },
  W: { bands: [YELLOW, BLACK, YELLOW], cones: ['down', 'up'] },
};
function cardinal(dir) {
  const g = new THREE.Group();
  const { bands, cones } = CARDINAL[dir];
  const h = 4.2 / bands.length;
  bands.forEach((c, i) => g.add(solid(new THREE.CylinderGeometry(0.75, 0.9, h, 8).translate(0, 4.2 - h / 2 - i * h - 0.4, 0), c, { outlineWidth: 0.04 })));
  g.add(solid(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 4).translate(0, 4.6, 0), BLACK, { outlineWidth: 0 }));
  cones.forEach((d, i) => {
    const cone = new THREE.ConeGeometry(0.45, 0.65, 8);
    if (d === 'down') cone.rotateX(Math.PI);
    g.add(solid(cone.translate(0, 4.5 + i * 0.85, 0), BLACK, { outlineWidth: 0.02 }));
  });
  g.scale.setScalar(1.6);
  return g;
}

// Danger isolé : bandes noires et rouges, deux boules noires.
function isolatedDanger() {
  const g = new THREE.Group();
  [BLACK, RED, BLACK].forEach((c, i) => g.add(solid(new THREE.CylinderGeometry(0.7, 0.85, 1.3, 8).translate(0, 3.4 - i * 1.3, 0), c, { outlineWidth: 0.04 })));
  for (let i = 0; i < 2; i++) g.add(solid(new THREE.SphereGeometry(0.38, 8, 6).translate(0, 4.6 + i * 0.85, 0), BLACK, { outlineWidth: 0.02 }));
  g.scale.setScalar(1.6);
  return g;
}

function fishingBoat() {
  const g = new THREE.Group();
  g.add(solid(new THREE.BoxGeometry(3.4, 1.8, 9).translate(0, 0.6, 0), '#2f6fe0', { outlineWidth: 0.06 }));
  g.add(solid(new THREE.ConeGeometry(1.75, 2.6, 4).rotateY(Math.PI / 4).rotateX(Math.PI / 2).scale(1, 0.75, 1).translate(0, 0.6, 5.7), '#2f6fe0', { outlineWidth: 0.06 }));
  g.add(solid(new THREE.BoxGeometry(3.5, 0.3, 9).translate(0, 1.55, 0), '#ffffff', { outlineWidth: 0 }));
  g.add(solid(new THREE.BoxGeometry(2.4, 2.2, 2.6).translate(0, 2.8, 1.2), '#f6f1e7', { outlineWidth: 0.05 }));
  g.add(solid(new THREE.BoxGeometry(2.6, 0.3, 2.8).translate(0, 4.0, 1.2), RED, { outlineWidth: 0.03 }));
  g.add(solid(new THREE.CylinderGeometry(0.08, 0.1, 5, 4).translate(0, 4.2, -2.6), '#9aa3ad', { outlineWidth: 0 }));
  g.add(solid(new THREE.BoxGeometry(0.1, 0.1, 4).rotateX(-0.6).translate(0, 4.6, -3.9), '#9aa3ad', { outlineWidth: 0 }));
  g.scale.setScalar(1.3);
  return g;
}

// Bateau PNJ qui tourne en boucle sur un tracé fermé, le cap suivant la tangente.
function cruise(anim, root, boat, points, lapSeconds, phase = 0) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true);
  root.add(boat);
  const tan = new THREE.Vector3();
  let u = phase;
  anim.push((dt, t) => {
    u = (u + dt / lapSeconds) % 1;
    const p = curve.getPointAt(u);
    curve.getTangentAt(u, tan);
    boat.position.set(p.x, Math.sin(t * 1.3 + phase * 9) * 0.15, p.z);
    boat.rotation.y = Math.atan2(tan.x, tan.z);
  });
}

export function buildDecor({ root, anim, circles, chenal, skipSegments = [], avoid = [], cardinals = [], dangers = [] }) {
  const R = rng(77);
  const clear = (x, z) => avoid.every((a) => Math.hypot(x - a.x, z - a.z) > a.r);

  // --- Balisage latéral le long du chenal, en direction du port.
  chenal.slice(0, -1).forEach((a, i) => {
    if (skipSegments.includes(i)) return;
    const b = chenal[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    const fx = dx / len, fz = dz / len;
    const left = { x: fz, z: -fx }; // bâbord quand on remonte vers le port
    const n = Math.max(1, Math.round(len / 65)); // espacées : un foiler doit pouvoir y virer de bord
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      const px = a.x + dx * t, pz = a.z + dz * t;
      for (const [side, s] of [['port', 1], ['starboard', -1]]) {
        const x = px + left.x * 28 * s, z = pz + left.z * 28 * s; // chenal de 56 m de large
        if (!clear(x, z)) continue;
        const m = lateral(side);
        m.position.set(x, 0, z);
        root.add(m);
        bob(anim, m, R() * 6);
        circles.push({ x, z, r: 1.8 });
      }
    }
  });

  // --- Cardinales et dangers isolés autour des écueils.
  for (const c of cardinals) {
    const m = cardinal(c.dir);
    m.position.set(c.x, 0, c.z);
    root.add(m);
    bob(anim, m, R() * 6);
    circles.push({ x: c.x, z: c.z, r: 1.8 });
  }
  for (const d of dangers) {
    const rock = solid(new THREE.IcosahedronGeometry(4, 0).scale(1, 0.45, 1), '#7d8792', { outlineWidth: 0.12 });
    rock.position.set(d.x + 4, 0, d.z + 2);
    root.add(rock);
    const m = isolatedDanger();
    m.position.set(d.x, 0, d.z);
    root.add(m);
    bob(anim, m, R() * 6);
    circles.push({ x: d.x + 4, z: d.z + 2, r: 4 }, { x: d.x, z: d.z, r: 1.8 });
  }

  return { cruise: (boat, pts, lap, phase) => cruise(anim, root, boat, pts, lap, phase), fishingBoat, keelboat };
}
