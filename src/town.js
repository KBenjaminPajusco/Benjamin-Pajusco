import * as THREE from 'three';
import { solid, toon, rng, PALETTE } from './toon.js?v=20261008151501';
import { person } from './characters.js?v=20261008151501';
import { keelboat } from './matchrace.js?v=20261008151501';
import { lampPost } from './island.js?v=20261008151501';

// La ville du port : vieille ville à rue sinueuse avec voitures, promenade avec passants,
// capitainerie, et une marina (pontons, places, bateaux amarrés) dans le bassin.
// Coordonnées dans le repère de construction du port : tout est rangé dans un groupe déplacé avec lui.

const HOUSE_COLORS = ['#f6efe2', '#f2d7b6', '#e7eef4', '#f4dcd6', '#e9f0dc'];
const ROOF_COLORS = ['#c8553d', '#55657a', '#a8483a', '#3c4a5c'];
const CAR_COLORS = ['#ff6a4d', '#4d7cff', '#ffc845', '#2f9e55', '#f6f1e7', '#a25dd9'];

const SHUTTERS = ['#3f7d5c', '#2f6fe0', '#55657a', '#7a1f2b'];

function house(R) {
  const g = new THREE.Group();
  const w = 7 + R() * 3, d = 6 + R() * 2, h = 4 + R() * 3.5;
  const wall = HOUSE_COLORS[Math.floor(R() * HOUSE_COLORS.length)];
  const roofC = ROOF_COLORS[Math.floor(R() * ROOF_COLORS.length)];
  g.add(solid(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), wall, { outlineWidth: 0.12 }));
  const style = R();
  if (style < 0.55) {
    // Toit à deux pans, avec débord, faîtage dans la longueur.
    const rh = 2 + R() * 1.4, o = 0.5;
    const tri = new THREE.Shape([new THREE.Vector2(-w / 2 - o, 0), new THREE.Vector2(w / 2 + o, 0), new THREE.Vector2(0, rh)]);
    g.add(solid(new THREE.ExtrudeGeometry(tri, { depth: d + o * 2, bevelEnabled: false }).translate(0, h, -d / 2 - o), roofC, { outlineWidth: 0.1 }));
    // Pignon de la couleur du mur sous le toit (côté façade).
    const gable = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rh - 0.3)]);
    g.add(solid(new THREE.ShapeGeometry(gable).translate(0, h, d / 2 + 0.02), wall, { outlineWidth: 0 }));
  } else if (style < 0.8) {
    // Toit à quatre pans, bas et large.
    g.add(solid(new THREE.CylinderGeometry(0, Math.hypot(w, d) / 2 + 0.6, 2.2, 4, 1).rotateY(Math.PI / 4).scale(w / d, 1, 1).translate(0, h + 1.1, 0), roofC, { outlineWidth: 0.1 }));
  } else {
    // Toit-terrasse méditerranéen : acrotère, plantes en pot, petit parasol.
    g.add(solid(new THREE.BoxGeometry(w + 0.3, 0.7, d + 0.3).translate(0, h + 0.35, 0), wall, { outlineWidth: 0.08 }));
    g.add(solid(new THREE.BoxGeometry(w - 0.6, 0.12, d - 0.6).translate(0, h + 0.1, 0), '#c9a66b', { outlineWidth: 0 }));
    g.add(solid(new THREE.IcosahedronGeometry(0.7, 0).translate(w / 2 - 1.2, h + 0.9, d / 2 - 1.2), '#4f8f4a', { outlineWidth: 0.04 }));
    g.add(solid(new THREE.CylinderGeometry(0.05, 0.05, 2, 4).translate(-w / 4, h + 1.1, 0), '#ffffff', { outlineWidth: 0 }));
    g.add(solid(new THREE.ConeGeometry(1.4, 0.6, 8).translate(-w / 4, h + 2.1, 0), '#ff6a4d', { outlineWidth: 0.04 }));
  }
  if (style < 0.8 && R() < 0.6) g.add(solid(new THREE.BoxGeometry(0.8, 2.4, 0.8).translate(w / 4, h + 1.6, -d / 5), '#9aa3ad', { outlineWidth: 0.05 }));
  // Porte, marche, fenêtres à volets.
  g.add(solid(new THREE.BoxGeometry(1.4, 2.2, 0.2).translate(0, 1.1, d / 2 + 0.05), '#5a3d2b', { outlineWidth: 0 }));
  g.add(solid(new THREE.BoxGeometry(2, 0.25, 0.8).translate(0, 0.12, d / 2 + 0.4), '#cfd6e0', { outlineWidth: 0 }));
  const sh = SHUTTERS[Math.floor(R() * SHUTTERS.length)];
  for (const s of [-1, 1]) {
    const wx = s * w / 3.2, wy = h * 0.62;
    g.add(solid(new THREE.BoxGeometry(1.2, 1.2, 0.2).translate(wx, wy, d / 2 + 0.05), '#4aa4de', { outlineWidth: 0 })); // WINDOW_COLOR : s'allume la nuit
    for (const t of [-1, 1]) g.add(solid(new THREE.BoxGeometry(0.55, 1.3, 0.12).translate(wx + t * 0.9, wy, d / 2 + 0.12), sh, { outlineWidth: 0 }));
  }
  return { g, w, d };
}

function car(color) {
  const g = new THREE.Group();
  g.add(solid(new THREE.BoxGeometry(2.2, 1.0, 4.2).translate(0, 0.8, 0), color, { outlineWidth: 0.05 }));
  g.add(solid(new THREE.BoxGeometry(1.9, 0.9, 2.2).translate(0, 1.7, -0.2), '#bfe9f5', { outlineWidth: 0.04 }));
  for (const [x, z] of [[-1.1, 1.3], [1.1, 1.3], [-1.1, -1.3], [1.1, -1.3]]) {
    g.add(solid(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 8).rotateZ(Math.PI / 2).translate(x, 0.45, z), '#1d2533', { outlineWidth: 0 }));
  }
  g.scale.setScalar(1.6);
  return g;
}

function motorboat(color) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 3.4); shape.quadraticCurveTo(1.3, 1.6, 1.2, -2.6); shape.lineTo(-1.2, -2.6); shape.quadraticCurveTo(-1.3, 1.6, 0, 3.4);
  g.add(solid(new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 4 }).rotateX(Math.PI / 2).translate(0, 1, 0), '#ffffff', { outlineWidth: 0.05 }));
  g.add(solid(new THREE.BoxGeometry(2.3, 0.25, 5.6).translate(0, 0.35, -0.1), color, { outlineWidth: 0 }));
  g.add(solid(new THREE.BoxGeometry(1.6, 0.9, 1.6).translate(0, 1.45, -0.4), '#3c4a5c', { outlineWidth: 0.04 }));
  g.scale.setScalar(1.4);
  return g;
}

export function buildTown({ root, anim, labels, circles, blocks, land, qTop, S }) {
  const R = rng(321);
  const town = new THREE.Group();
  root.add(town);
  const Y = qTop;

  // Outils de voirie : tronçon droit et pointillés.
  const seg = (x, z, w, d) => {
    town.add(solid(new THREE.BoxGeometry(w, 0.1, d).translate(x, Y + 0.06, z), '#4b5566', { outlineWidth: 0, cast: false }));
  };
  const dash = new THREE.MeshBasicMaterial({ color: '#f6f1e7' });
  const dashes = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 5);
    for (let k = 0; k < n; k += 2) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 2.2).rotateX(-Math.PI / 2), dash);
      m.position.set(ax + ((bx - ax) * (k + 0.5)) / n, Y + 0.13, az + ((bz - az) * (k + 0.5)) / n);
      m.rotation.y = Math.atan2(bx - ax, bz - az);
      town.add(m);
    }
  };

  // --- Vieille ville façon Palma : une rue sinueuse en boucle, des maisons tournées vers elle, une place.
  const Y2 = Y + 0.06;
  const streetPts = [[216, -298], [246, -289], [276, -298], [287, -332], [272, -366], [286, -404], [258, -428], [226, -420], [210, -388], [224, -350]];
  const street = new THREE.CatmullRomCurve3(streetPts.map(([x, z]) => new THREE.Vector3(x, Y2, z)), true, 'catmullrom', 0.5);
  const N = 220, W = 3.6;
  const pos = [], idx = [];
  const tan = new THREE.Vector3();
  for (let i = 0; i <= N; i++) {
    const u = (i % N) / N;
    const p = street.getPointAt(u);
    street.getTangentAt(u, tan);
    const nx = -tan.z, nz = tan.x;
    pos.push(p.x + nx * W, Y2, p.z + nz * W, p.x - nx * W, Y2, p.z - nz * W);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  roadGeo.setIndex(idx);
  roadGeo.computeVertexNormals();
  const roadMesh = new THREE.Mesh(roadGeo, toon('#4b5566', { side: THREE.DoubleSide }));
  roadMesh.receiveShadow = true;
  town.add(roadMesh);
  for (let i = 0; i < N; i += 4) {
    const u = i / N;
    const p = street.getPointAt(u);
    street.getTangentAt(u, tan);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1.8).rotateX(-Math.PI / 2), dash);
    m.position.set(p.x, Y2 + 0.06, p.z);
    m.rotation.y = Math.atan2(tan.x, tan.z);
    town.add(m);
  }
  // Promenade du front de mer, bordée de lampadaires (sans route : on y marche).
  for (let x = 292; x <= 440; x += 24) {
    const l = lampPost(Y);
    l.position.set(x, 0, -273.5);
    l.rotation.y = Math.PI;
    town.add(l);
  }

  // Distance d'un point à la rue (échantillonnée).
  const streetSamples = Array.from({ length: 120 }, (_, i) => street.getPointAt(i / 120));
  const distToStreet = (x, z) => Math.min(...streetSamples.map((p) => Math.hypot(p.x - x, p.z - z)));

  // Maisons : des deux côtés de la rue, légèrement de travers, tailles variées, jamais sur la rue ni entre elles.
  const placed = [];
  const tryHouse = (x, z, face) => {
    if (x < 203 || x > 292 || z < -433 || z > -286) return;
    if (distToStreet(x, z) < 8.5) return;
    if (Math.hypot(x - 249, z - 360) < 15) return; // la place reste dégagée
    if (placed.some((q) => Math.hypot(q.x - x, q.z - z) < 10.5)) return;
    const { g, w, d } = house(R);
    g.scale.setScalar(0.85 + R() * 0.25);
    g.position.set(x, Y, z);
    g.rotation.y = face + (R() - 0.5) * 0.25;
    town.add(g);
    placed.push({ x, z });
    blocks.circles.push({ x, z, r: Math.max(w, d) * 0.5 });
  };
  for (let i = 0; i < 120; i += 3) {
    const u = i / 120, p = street.getPointAt(u);
    street.getTangentAt(u, tan);
    const nx = -tan.z, nz = tan.x;
    for (const s of [1, -1]) {
      const off = 10 + R() * 4;
      const x = p.x + nx * off * s, z = p.z + nz * off * s;
      tryHouse(x, z, Math.atan2(p.x - x, p.z - z)); // la façade regarde la rue
    }
  }
  // Seconde couronne, plus clairsemée, vers l'intérieur et les bords.
  for (let k = 0; k < 60; k++) tryHouse(206 + R() * 84, -430 + R() * 142, R() * Math.PI * 2);

  // La place, avec sa fontaine et ses arbres.
  town.add(solid(new THREE.CylinderGeometry(13, 13, 0.14, 18).translate(249, Y + 0.08, -360), '#e9dcc3', { outlineWidth: 0.06, cast: false }));
  town.add(solid(new THREE.CylinderGeometry(3.2, 3.6, 1.2, 12).translate(249, Y + 0.6, -360), '#cfd6e0', { outlineWidth: 0.06 }));
  town.add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.2, 12).translate(249, Y + 1.15, -360), new THREE.MeshBasicMaterial({ color: '#6cc6dc' })));
  town.add(solid(new THREE.CylinderGeometry(0.4, 0.6, 2.4, 6).translate(249, Y + 2.2, -360), '#cfd6e0', { outlineWidth: 0.04 }));
  blocks.circles.push({ x: 249, z: -360, r: 4.2 });
  for (const [dx, dz] of [[-9, -6], [9, -6], [-9, 6], [9, 6]]) {
    town.add(solid(new THREE.CylinderGeometry(0.3, 0.4, 2.4, 5).translate(249 + dx, Y + 1.2, -360 + dz), PALETTE.wood, { outlineWidth: 0.06 }));
    town.add(solid(new THREE.IcosahedronGeometry(2.2, 0).translate(249 + dx, Y + 4, -360 + dz), '#4f8f4a', { outlineWidth: 0.08 }));
  }

  // Lampadaires le long de la rue de la vieille ville.
  for (let i = 0; i < 120; i += 10) {
    const u = i / 120, p = street.getPointAt(u);
    street.getTangentAt(u, tan);
    const l = lampPost(Y);
    l.position.set(p.x - tan.z * 5, 0, p.z + tan.x * 5);
    l.rotation.y = Math.atan2(tan.z, -tan.x);
    town.add(l);
  }

  // Voitures qui suivent la rue sinueuse.
  CAR_COLORS.slice(0, 4).forEach((c, i) => {
    const m = car(c);
    town.add(m);
    anim.push((dt, t) => {
      const u = (i / 4 + t * 0.012) % 1;
      const p = street.getPointAt(u);
      street.getTangentAt(u, tan);
      // On roule à droite : décalage d'une demi-voie.
      m.position.set(p.x - tan.z * 1.7, Y, p.z + tan.x * 1.7);
      m.rotation.y = Math.atan2(tan.x, tan.z);
    });
  });

  // --- Capitainerie : bâtiment blanc à tour de guet, au bord du bassin.
  const cap = new THREE.Group();
  cap.position.set(305, Y, -298);
  cap.add(solid(new THREE.BoxGeometry(16, 7, 10).translate(0, 3.5, 0), '#f6f1e7', { outlineWidth: 0.15 }));
  cap.add(solid(new THREE.BoxGeometry(16.6, 0.6, 10.6).translate(0, 7.3, 0), '#14275b', { outlineWidth: 0.08 }));
  cap.add(solid(new THREE.BoxGeometry(5, 9, 5).translate(-4, 11.5, 0), '#f6f1e7', { outlineWidth: 0.12 }));
  cap.add(solid(new THREE.BoxGeometry(5.6, 2, 5.6).translate(-4, 15, 0), '#4aa3df', { outlineWidth: 0.08 }));
  cap.add(solid(new THREE.ConeGeometry(4.2, 2.4, 4).rotateY(Math.PI / 4).translate(-4, 17.2, 0), '#14275b', { outlineWidth: 0.08 }));
  cap.add(solid(new THREE.CylinderGeometry(0.1, 0.1, 6, 4).translate(5, 10, 0), '#9aa3ad', { outlineWidth: 0 }));
  cap.add(solid(new THREE.BoxGeometry(0.05, 1.4, 2.2).translate(5, 12.2, 1.1), '#e8404a', { outlineWidth: 0 }));
  town.add(cap);
  blocks.boxes.push({ x: 305, z: -298, hx: 8.5, hz: 5.5 });

  // --- Passants sur la promenade du front de mer.
  for (let i = 0; i < 7; i++) {
    const p = person({ shirt: CAR_COLORS[i % CAR_COLORS.length], pants: i % 2 ? '#26324a' : '#55607a' });
    p.scale.setScalar(S);
    town.add(p);
    const x0 = 290, x1 = 440, speed = 3 + R() * 2, ph = R();
    const zLane = -274 + (i % 2) * 2.5;
    anim.push((dt, t) => {
      const u = (ph + (t * speed) / (2 * (x1 - x0))) % 1;
      const fwd = u < 0.5;
      const k = fwd ? u * 2 : 2 - u * 2;
      p.position.set(x0 + (x1 - x0) * k, Y, zLane);
      p.rotation.y = fwd ? Math.PI / 2 : -Math.PI / 2;
      p.userData.legs.forEach((l, j) => { l.rotation.x = Math.sin(t * 7 + i + j * Math.PI) * 0.6; });
      p.userData.arms.forEach((a, j) => { a.rotation.x = -Math.sin(t * 7 + i + j * Math.PI) * 0.4; });
    });
  }

  // --- Habillage du front de mer, entre la route du parc et le quai (les passants gardent leurs deux couloirs).
  {
    const ground = (w, d, x, z, color, y = 0.05) => town.add(new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, Y + y, z), toon(color)));
    const solidAt = (geo, color, x, z, ry = 0, w = 0.04) => { const m = solid(geo, color, { outlineWidth: w }); m.position.set(x, Y, z); m.rotation.y = ry; town.add(m); return m; };
    // Promenade dallée le long du quai, avec ses joints.
    ground(166, 7.5, 369, -272.4, '#e7dcc6');
    for (let x = 288; x <= 450; x += 6) ground(0.12, 7.5, x, -272.4, '#d6c9ae', 0.06);
    // Bornes d'amarrage au bord du quai.
    for (let x = 290; x <= 448; x += 8) solidAt(new THREE.CylinderGeometry(0.28, 0.34, 0.9, 6).translate(0, 0.45, 0), '#3c4a5c', x, -268.8, 0, 0.03);
    // Bancs tournés vers la mer, chacun avec sa poubelle, entre les lampadaires.
    const bench = (x, z, ry) => {
      const g = new THREE.Group();
      g.add(solid(new THREE.BoxGeometry(3.4, 0.25, 1).translate(0, 1, 0), PALETTE.wood, { outlineWidth: 0.04 }));
      g.add(solid(new THREE.BoxGeometry(3.4, 0.9, 0.2).translate(0, 1.55, -0.45), PALETTE.wood, { outlineWidth: 0.04 }));
      for (const dx of [-1.4, 1.4]) g.add(solid(new THREE.BoxGeometry(0.16, 1, 0.9).translate(dx, 0.5, 0), '#3c4a5c', { outlineWidth: 0.02 }));
      g.position.set(x, Y, z);
      g.rotation.y = ry;
      town.add(g);
      circles.push({ x, z, r: 1.8 });
    };
    const bin = (x, z) => {
      solidAt(new THREE.CylinderGeometry(0.45, 0.4, 1.2, 8).translate(0, 0.6, 0), '#2f6b5a', x, z, 0, 0.04);
      solidAt(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 8).translate(0, 1.26, 0), '#3c4a5c', x, z, 0, 0.02);
    };
    for (const x of [304, 328, 352, 400, 424]) { bench(x, -277.6, 0); bin(x + 3.2, -277.4); }
    // Jardinières plantées derrière la promenade, coupées par des passages.
    const flowers = ['#e8404a', '#ffc845', '#ffffff', '#a25dd9'];
    let fk = 0;
    for (const [x0, x1] of [[290, 322], [338, 358], [386, 406], [420, 450]]) {
      const cx = (x0 + x1) / 2, w = x1 - x0;
      solidAt(new THREE.BoxGeometry(w, 0.6, 3).translate(0, 0.3, 0), '#cfc3a6', cx, -282, 0, 0.05);
      ground(w - 0.6, 2.4, cx, -282, '#5f8f4a', 0.62);
      for (let x = x0 + 2; x < x1 - 1; x += 3.2) {
        const shrub = solid(new THREE.IcosahedronGeometry(0.75, 0).translate(0, 1.15, 0), '#4f8a3c', { outlineWidth: 0.04 });
        shrub.position.set(x, Y, -282 + ((fk % 2) - 0.5) * 0.8);
        town.add(shrub);
        const fl = solid(new THREE.IcosahedronGeometry(0.28, 0).translate(0, 0.85, 0), flowers[fk % flowers.length], { outlineWidth: 0 });
        fl.position.set(x + 1.5, Y, -282);
        town.add(fl);
        fk++;
      }
      blocks.boxes.push({ x: cx, z: -282, hx: w / 2, hz: 1.5 });
    }
    // Placette et fontaine au centre de la promenade.
    const FX = 372, FZ = -289.5;
    town.add(new THREE.Mesh(new THREE.CircleGeometry(8, 24).rotateX(-Math.PI / 2).translate(FX, Y + 0.05, FZ), toon('#e7dcc6')));
    town.add(new THREE.Mesh(new THREE.RingGeometry(6.2, 6.6, 24).rotateX(-Math.PI / 2).translate(FX, Y + 0.06, FZ), toon('#d6c9ae')));
    ground(6, 8, FX, -280, '#e7dcc6');
    solidAt(new THREE.CylinderGeometry(3.6, 3.8, 0.8, 16).translate(0, 0.4, 0), '#d9d4c8', FX, FZ, 0, 0.06);
    town.add(new THREE.Mesh(new THREE.CircleGeometry(3.2, 16).rotateX(-Math.PI / 2).translate(FX, Y + 0.78, FZ), new THREE.MeshBasicMaterial({ color: '#7fd0ea' })));
    solidAt(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 8).translate(0, 1.1, 0), '#d9d4c8', FX, FZ, 0, 0.04);
    solidAt(new THREE.CylinderGeometry(1.1, 0.4, 0.4, 10).translate(0, 2.3, 0), '#d9d4c8', FX, FZ, 0, 0.04);
    solidAt(new THREE.IcosahedronGeometry(0.5, 0).scale(1, 1.6, 1).translate(0, 2.9, 0), '#bfe8f5', FX, FZ, 0, 0);
    circles.push({ x: FX, z: FZ, r: 4 });
    bench(FX - 6.2, FZ - 1, Math.PI / 2);
    bench(FX + 6.2, FZ - 1, -Math.PI / 2);
    for (const dx of [-9, 9]) {
      solidAt(new THREE.CylinderGeometry(0.9, 0.7, 1, 8).translate(0, 0.5, 0), '#c8553d', FX + dx, FZ + 4, 0, 0.05);
      solidAt(new THREE.IcosahedronGeometry(1.1, 0).scale(1, 1.3, 1).translate(0, 1.9, 0), '#4f8f4a', FX + dx, FZ + 4, 0, 0.06);
      circles.push({ x: FX + dx, z: FZ + 4, r: 1 });
    }
    // Kiosque à glaces, son auvent rayé, un parasol et deux tables.
    const KX = 336, KZ = -290;
    solidAt(new THREE.BoxGeometry(4.4, 3, 3.2).translate(0, 1.5, 0), '#f6f1e7', KX, KZ, 0, 0.06);
    for (let k = 0; k < 5; k++) solidAt(new THREE.BoxGeometry(0.88, 0.18, 2.2).rotateX(0.35).translate(-1.76 + k * 0.88, 3.1, 2.2), k % 2 ? '#ffffff' : '#e8404a', KX, KZ, 0, 0.02);
    solidAt(new THREE.BoxGeometry(4.6, 0.3, 3.4).translate(0, 3.15, 0), '#e8404a', KX, KZ, 0, 0.04);
    solidAt(new THREE.SphereGeometry(0.7, 8, 6).translate(0, 4, 0), '#ffc845', KX, KZ, 0, 0.04);
    blocks.boxes.push({ x: KX, z: KZ, hx: 2.4, hz: 1.8 });
    for (const [dx, dz] of [[-4.5, 4.5], [4.5, 4.5]]) {
      solidAt(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 10).translate(0, 1.05, 0), '#ffffff', KX + dx, KZ + dz, 0, 0.03);
      solidAt(new THREE.CylinderGeometry(0.08, 0.08, 1, 4).translate(0, 0.5, 0), '#3c4a5c', KX + dx, KZ + dz, 0, 0);
      circles.push({ x: KX + dx, z: KZ + dz, r: 0.9 });
    }
    solidAt(new THREE.ConeGeometry(2.6, 1, 8).translate(0, 3.6, 0), '#4d7cff', KX, KZ + 4.5, 0, 0.05);
    solidAt(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 4).translate(0, 1.7, 0), '#9aa3ad', KX, KZ + 4.5, 0, 0);
    // Arceaux à vélos près de la capitainerie, et un panneau d'information.
    for (let k = 0; k < 4; k++) solidAt(new THREE.TorusGeometry(0.55, 0.07, 4, 10, Math.PI).translate(0, 0.1, 0), '#9aa3ad', 318 + k * 1.3, -287, Math.PI / 2, 0);
    solidAt(new THREE.BoxGeometry(2.6, 1.6, 0.2).translate(0, 2.2, 0), '#14275b', 296, -280.5, 0, 0.05);
    solidAt(new THREE.BoxGeometry(2.2, 1.2, 0.05).translate(0, 2.2, 0.13), '#f6f1e7', 296, -280.5, 0, 0);
    for (const dx of [-1.1, 1.1]) solidAt(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 4).translate(dx, 1.2, 0), '#3c4a5c', 296, -280.5, 0, 0);
    circles.push({ x: 296, z: -280.5, r: 1.4 });
    // Alignement d'arbres en grilles, le long de la route du parc.
    for (const [k, x] of [322, 352, 392, 408, 424, 440].entries()) {
      ground(2.4, 2.4, x, -293, '#3c4a5c', 0.07);
      solidAt(new THREE.CylinderGeometry(0.28, 0.38, 3, 5).translate(0, 1.5, 0), PALETTE.wood, x, -293, 0, 0.05);
      solidAt(new THREE.IcosahedronGeometry(2 + (k % 3) * 0.3, 0).scale(1, 1.15, 1).translate(0, 4.6, 0), k % 2 ? '#4f8a3c' : '#5f9e48', x, -293, k, 0.08);
      circles.push({ x, z: -293, r: 0.8 });
    }
  }

  // --- Marina dans le bassin ouest : deux pontons à catways, des places, des bateaux amarrés.
  const wood = PALETTE.wood;
  const sailColors = ['#ffffff', '#ffc845', '#4d7cff', '#ff6a4d'];
  [-252, -222].forEach((pz, row) => {
    const x0 = 296, x1 = 392;
    town.add(solid(new THREE.BoxGeometry(x1 - x0, 0.8, 3).translate((x0 + x1) / 2, 0.5, pz), wood, { outlineWidth: 0.08 }));
    land.boxes.push({ x: (x0 + x1) / 2, z: pz, hx: (x1 - x0) / 2, hz: 1.5, y: 1.0 });
    circles.push(...Array.from({ length: 8 }, (_, k) => ({ x: x0 + 6 + k * 12, z: pz, r: 2.5 })));
    for (let k = 0; k < 8; k++) {
      const cx = x0 + 6 + k * 12;
      for (const side of [-1, 1]) {
        town.add(solid(new THREE.BoxGeometry(1.2, 0.6, 7).translate(cx + 4, 0.45, pz + side * 5), wood, { outlineWidth: 0.05 }));
        if (R() < 0.72) {
          const sail = R() < 0.55;
          const b = sail ? keelboat('#f6f1e7', sailColors[Math.floor(R() * sailColors.length)]) : motorboat(CAR_COLORS[Math.floor(R() * CAR_COLORS.length)]);
          if (sail) {
            b.userData.spi.visible = false;
            b.userData.jib.visible = false;
            b.userData.main.visible = false; // voiles affalées au port : seul le mât reste
          }
          b.position.set(cx - 1, 0, pz + side * 6.5);
          b.rotation.y = side > 0 ? 0 : Math.PI;
          town.add(b);
          circles.push({ x: cx - 1, z: pz + side * 6.5, r: 3 });
          const ph = R() * 6;
          anim.push((dt, t) => { b.position.y = Math.sin(t * 1.2 + ph) * 0.12; });
        }
      }
    }
  });
}
