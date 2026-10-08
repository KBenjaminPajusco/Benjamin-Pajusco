import * as THREE from 'three';
import { solid, toon } from './toon.js?v=20261008134250';
import { navLights } from './island.js?v=20261008134250';

// Petit match race en boucle à côté de la bouée « Sportif de haut niveau », pour le décor :
// procédure de départ en tournant, louvoyage où les bateaux se croisent, bouée au vent, retour au portant.

export function keelboat(hullColor, sailColor) {
  const g = new THREE.Group();
  const tilt = new THREE.Group();
  g.add(tilt);
  const shape = new THREE.Shape();
  shape.moveTo(0, 4.2);
  shape.quadraticCurveTo(1.25, 1.5, 1.15, -3.4);
  shape.lineTo(-1.15, -3.4);
  shape.quadraticCurveTo(-1.25, 1.5, 0, 4.2);
  const hull = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false, curveSegments: 4 }).rotateX(Math.PI / 2).translate(0, 0.9, 0);
  tilt.add(solid(hull, hullColor, { outlineWidth: 0.06 }));
  tilt.add(solid(new THREE.BoxGeometry(1.5, 0.12, 5.6).translate(0, 0.95, -0.6), '#f4f1ea', { outlineWidth: 0 }));
  tilt.add(solid(new THREE.CylinderGeometry(0.07, 0.1, 10, 5).translate(0, 5.9, 0.9), '#e9e4da', { outlineWidth: 0.03 }));
  for (let k = 0; k < 3; k++) tilt.add(solid(new THREE.IcosahedronGeometry(0.22, 0).translate(k % 2 ? 0.35 : -0.35, 1.3, -1 - k * 0.9), hullColor, { outlineWidth: 0.02 }));

  const sailMat = toon(sailColor, { side: THREE.DoubleSide, flatShading: true });
  const main = new THREE.Group();
  main.position.set(0, 0, 0.9);
  const mainGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 10.6, 0), new THREE.Vector3(0, 1.4, -3.8)]);
  mainGeo.computeVertexNormals();
  main.add(new THREE.Mesh(mainGeo, sailMat));
  tilt.add(main);
  const jib = new THREE.Group();
  jib.position.set(0, 0, 4);
  const jibGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.1, 0), new THREE.Vector3(0, 8.6, -3), new THREE.Vector3(0, 1.3, -3.4)]);
  jibGeo.computeVertexNormals();
  jib.add(new THREE.Mesh(jibGeo, toon('#ffffff', { side: THREE.DoubleSide, flatShading: true })));
  tilt.add(jib);
  // Spi : une bulle de couleur qui ne sort qu'au portant.
  const spi = solid(new THREE.SphereGeometry(2.6, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.6).scale(1, 1.3, 0.7).translate(0, 5.5, 6.2), sailColor, { outlineWidth: 0.04 });
  tilt.add(spi);
  navLights(tilt, { port: [1.0, 1.2, 3.0], starboard: [-1.0, 1.2, 3.0], mast: [0, 11.1, 0.9], size: 2.4 });
  g.userData = { tilt, main, jib, spi };
  return g;
}

// Parcours fermé (Catmull-Rom) parcouru à vitesse constante.
function loop(points) {
  return new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', 0.35);
}

const LAP = 46; // secondes par tour
const K = 1; // échelle du parcours (1 = ligne à 78 m de la bouée au vent)

export function buildMatchRace({ root, anim, labels, circles, map, committeeAt }) {
  // Le parcours se cale sur le bateau comité : la bouée au vent est 78 m au nord de la ligne.
  const cx = committeeAt.x + 22 * K, cz = committeeAt.z - 78 * K;
  const P = (dx, dz) => [cx + dx * K, cz + dz * K];
  const committee = P(-22, 78), pin = P(22, 78), windward = P(0, 0);

  // Bateau comité, viseur et bouée au vent.
  const comm = new THREE.Group();
  comm.position.set(committee[0], 0, committee[1]);
  comm.add(solid(new THREE.BoxGeometry(3, 1.2, 7).translate(0, 0.5, 0), '#f6f1e7', { outlineWidth: 0.06 }));
  comm.add(solid(new THREE.BoxGeometry(2.2, 1.4, 2.6).translate(0, 1.8, -0.8), '#3c4a5c', { outlineWidth: 0.05 }));
  comm.add(solid(new THREE.CylinderGeometry(0.06, 0.06, 5, 4).translate(0, 3.6, 1.5), '#9aa3ad', { outlineWidth: 0 }));
  comm.add(solid(new THREE.BoxGeometry(0.05, 0.9, 1.3).translate(0, 5.4, 2.15), '#ff6a4d', { outlineWidth: 0 }));
  root.add(comm);
  const mark = (p, col, h) => {
    const m = solid(new THREE.CylinderGeometry(1.1, 1.3, h, 8).translate(0, h / 2 - 0.3, 0), col, { outlineWidth: 0.06 });
    m.position.set(p[0], 0, p[1]);
    root.add(m);
    circles.push({ x: p[0], z: p[1], r: 1.8 });
    map.marks.push({ x: p[0], z: p[1] });
    const ph = Math.random() * 6;
    anim.push((dt, t) => { m.position.y = Math.sin(t * 1.7 + ph) * 0.2; });
  };
  mark(pin, '#ff9f1c', 2.6);
  mark(windward, '#ff9f1c', 3.4);
  circles.push({ x: committee[0], z: committee[1], r: 4 });

  // Ligne de départ en pointillés.
  const dashMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75 });
  for (let k = 1; k < 12; k += 2) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5).rotateX(-Math.PI / 2), dashMat);
    d.position.set(THREE.MathUtils.lerp(committee[0], pin[0], k / 12), 0.1, committee[1]);
    root.add(d);
  }

  // Deux tracés qui se croisent au près : chaque virement se fait devant l'autre bateau.
  const yellowPath = loop([
    P(-26, 90), P(-12, 96), P(2, 90), P(-8, 82), // tour de prédépart juste sous la ligne
    P(-6, 76), P(22, 52), P(-14, 30), P(14, 10), P(6, -6), P(-6, -4), // louvoyage puis virement de la bouée
    P(-14, 30), P(-24, 66), P(-30, 84),
  ]);
  const bluePath = loop([
    P(26, 92), P(12, 98), P(-2, 92), P(8, 84),
    P(8, 76), P(-20, 56), P(16, 36), P(-12, 16), P(-6, -6), P(6, -5),
    P(16, 34), P(26, 68), P(30, 86),
  ]);
  const boats = [
    { g: keelboat('#ffc845', '#ffc845'), path: yellowPath, u: 0.26 },
    // Bleu suit à 26 % de tour : le plus petit écart où les coques restent à ≥ 14 m l'une de l'autre.
    { g: keelboat('#2f6fe0', '#2f6fe0'), path: bluePath, u: 0 },
  ];
  const tan = new THREE.Vector3();
  for (const b of boats) {
    b.g.scale.setScalar(1.35); // un peu plus gros que nature pour rester lisibles depuis la caméra haute
    root.add(b.g);
    b.len = b.path.getLength();
    b.speed = b.len / LAP; // même temps au tour : l'écart entre les deux bateaux reste constant
    b.side = 1;
  }
  const out = { committee: { x: committee[0], z: committee[1] } };
  anim.push((dt, t) => {
    for (const b of boats) {
      b.u = (b.u + (b.speed * dt) / b.len) % 1;
      const p = b.path.getPointAt(b.u);
      b.path.getTangentAt(b.u, tan);
      const heading = Math.atan2(tan.x, tan.z);
      b.g.position.set(p.x, 0, p.z);
      b.g.rotation.y = heading;
      // Vent du nord : angle au vent et côté sous le vent pour border les voiles.
      const twa = Math.PI - Math.abs(Math.atan2(Math.sin(heading), Math.cos(heading)));
      const side = Math.sign(Math.sin(heading)) || b.side;
      b.side = THREE.MathUtils.damp(b.side, side, 4, dt);
      const { tilt, main, jib, spi } = b.g.userData;
      const trim = 0.1 + 0.9 * Math.pow(twa / Math.PI, 2);
      main.rotation.y = b.side * trim;
      jib.rotation.y = b.side * trim * 0.8;
      const downwind = twa > 2.0;
      spi.visible = downwind;
      jib.visible = !downwind;
      tilt.rotation.z = THREE.MathUtils.damp(tilt.rotation.z, (downwind ? 0.02 : 0.16) * b.side, 3, dt);
      tilt.rotation.x = Math.sin(t * 2 + b.u * 40) * 0.02;
    }
  });
  return out;
}
