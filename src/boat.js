import * as THREE from 'three';
import { solid, toon, outline, PALETTE } from './toon.js?v=20261008134250';
import { navLights } from './island.js?v=20261008134250';

// Foiler monocoque stylisé. Seules les cotes globales s'inspirent d'un AC40
// (L ≈ 12,5 m, bau ≈ 3,3 m, bras de foil ≈ 3 m) ; toute la géométrie est générée ici.
const L = 12.5;
const MAST_Z = 1.2;

// Stations de la coque, de l'arrière (t=0) vers l'étrave (t=1) : demi-bau, pont, fond.
const STATIONS = [
  { t: 0.0, w: 1.35, deck: 0.95, keel: 0.18 },
  { t: 0.15, w: 1.5, deck: 0.95, keel: 0.02 },
  { t: 0.35, w: 1.62, deck: 1.0, keel: -0.1 },
  { t: 0.55, w: 1.65, deck: 1.05, keel: -0.1 },
  { t: 0.75, w: 1.5, deck: 1.05, keel: 0.0 },
  { t: 0.9, w: 1.15, deck: 0.95, keel: 0.28 },
  { t: 1.0, w: 0.55, deck: 0.72, keel: 0.62 },
];

function sectionLoop(s) {
  const chineY = s.keel + 0.28;
  const midY = (s.deck + chineY) / 2;
  return [
    [s.w, s.deck], [s.w * 0.96, midY], [s.w * 0.8, chineY], [0, s.keel],
    [-s.w * 0.8, chineY], [-s.w * 0.96, midY], [-s.w, s.deck], [0, s.deck + 0.1],
  ];
}
const DECK_SEGMENTS = new Set([6, 7]); // segments (-w,deck)->centre et centre->(w,deck)

function hullGeometry() {
  const pos = [];
  const hullIdx = [];
  const deckIdx = [];
  const rings = STATIONS.map((s) => {
    const z = -L / 2 + s.t * L;
    return sectionLoop(s).map(([x, y]) => {
      pos.push(x, y, z);
      return pos.length / 3 - 1;
    });
  });
  const n = rings[0].length;
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < n; k++) {
      const a = rings[i][k], b = rings[i][(k + 1) % n], c = rings[i + 1][(k + 1) % n], d = rings[i + 1][k];
      (DECK_SEGMENTS.has(k) ? deckIdx : hullIdx).push(a, c, b, a, d, c);
    }
  }
  // Tableau arrière et étrave de scow : éventails depuis le centre de la section.
  const cap = (ring, flip) => {
    let cx = 0, cy = 0, cz = 0;
    ring.forEach((i) => { cx += pos[i * 3]; cy += pos[i * 3 + 1]; cz += pos[i * 3 + 2]; });
    pos.push(cx / n, cy / n, cz / n);
    const c = pos.length / 3 - 1;
    for (let k = 0; k < n; k++) {
      const a = ring[k], b = ring[(k + 1) % n];
      if (flip) hullIdx.push(c, b, a); else hullIdx.push(c, a, b);
    }
  };
  cap(rings[0], false);
  cap(rings[rings.length - 1], true);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex([...hullIdx, ...deckIdx]);
  g.addGroup(0, hullIdx.length, 0);
  g.addGroup(hullIdx.length, deckIdx.length, 1);
  g.computeVertexNormals(); // indispensable à l'éclairage toon, même en flatShading
  return g;
}

function sailTexture(label = 'BP', accent = PALETTE.accent) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = PALETTE.sail; ctx.fillRect(0, 0, 256, 512);
  ctx.fillStyle = accent; ctx.fillRect(0, 150, 256, 26);
  ctx.fillStyle = '#26324a';
  ctx.font = 'bold 120px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 100, 330);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Voile = grille (u le long de la corde, v le long du guindant). Les x sont recalculés à chaque frame.
class Sail {
  constructor({ luff0, luff1, leech0, leech1, segU = 4, segV = 8, material }) {
    this.luff0 = luff0; this.luff1 = luff1; this.leech0 = leech0; this.leech1 = leech1;
    this.segU = segU; this.segV = segV;
    const g = new THREE.PlaneGeometry(1, 1, segU, segV);
    this.geometry = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.castShadow = true;
    this.update(1, 0.2, 0.1);
  }
  update(side, angle, camber) {
    const p = this.geometry.attributes.position;
    const uv = this.geometry.attributes.uv;
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      a.lerpVectors(this.luff0, this.luff1, v);
      b.lerpVectors(this.leech0, this.leech1, v);
      const chord = a.distanceTo(b);
      const x = -side * (u * chord * Math.sin(angle) + camber * 4 * u * (1 - u) * chord);
      p.setXYZ(i, x, THREE.MathUtils.lerp(a.y, b.y, u), THREE.MathUtils.lerp(a.z, b.z, u));
    }
    p.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
}

function foilArm(sign) {
  const pivot = new THREE.Group();
  pivot.position.set(sign * 1.55, 0.55, 0.6);
  const arm = solid(new THREE.BoxGeometry(0.16, 3.0, 0.42).translate(0, -1.5, 0), PALETTE.foil, { outlineWidth: 0.04 });
  pivot.add(arm);
  const wing = solid(new THREE.BoxGeometry(2.4, 0.1, 0.5), PALETTE.foil, { outlineWidth: 0.04 });
  wing.position.set(0, -3.0, 0.05);
  pivot.add(wing);
  for (const s of [-1, 1]) {
    const tip = solid(new THREE.BoxGeometry(0.5, 0.08, 0.36), PALETTE.accent, { outlineWidth: 0.03 });
    tip.position.set(s * 1.38, -2.92, 0.02);
    tip.rotation.z = s * 0.4;
    pivot.add(tip);
  }
  // Point d'où part le sillage quand le bateau vole.
  pivot.userData.tip = new THREE.Object3D();
  pivot.userData.tip.position.set(0, -3.0, 0);
  pivot.add(pivot.userData.tip);
  return pivot;
}

function polar(twa) {
  const d = THREE.MathUtils.radToDeg(twa);
  if (d < 30) return 0.2;
  if (d < 50) return THREE.MathUtils.mapLinear(d, 30, 50, 0.2, 0.75);
  if (d < 100) return THREE.MathUtils.mapLinear(d, 50, 100, 0.75, 1.0);
  if (d < 150) return THREE.MathUtils.mapLinear(d, 100, 150, 1.0, 0.9);
  return THREE.MathUtils.mapLinear(d, 150, 180, 0.9, 0.7);
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Boat {
  constructor({ label = 'BP', accent = PALETTE.accent, hullColor = PALETTE.hull, rig = true } = {}) {
    this.root = new THREE.Group();
    this.tilt = new THREE.Group();
    this.root.add(this.tilt);

    const hull = new THREE.Mesh(hullGeometry(), [toon(hullColor, { flatShading: true }), toon(PALETTE.deck, { flatShading: true })]);
    hull.castShadow = hull.receiveShadow = true;
    outline(hull, 0.07);
    this.tilt.add(hull);

    const cockpit = solid(new THREE.BoxGeometry(0.8, 0.14, 6.2), '#262f3d', { outlineWidth: 0 });
    cockpit.position.set(0, 1.08, -1.9);
    this.tilt.add(cockpit);
    const helmets = rig ? [PALETTE.accent, '#ffffff', PALETTE.accent, '#ffffff'] : [];
    helmets.forEach((c, i) => {
      const head = solid(new THREE.IcosahedronGeometry(0.24, 0), c, { outlineWidth: 0.03 });
      head.position.set(i % 2 ? 0.18 : -0.18, 1.35, -0.6 - i * 1.15);
      this.tilt.add(head);
    });

    // Mât, voiles et feux : absents quand le bateau est à terre, sur son ber.
    if (rig) {
      const mast = solid(new THREE.CylinderGeometry(0.12, 0.2, 17, 6).scale(0.55, 1, 1.4).translate(0, 8.5 + 1.0, 0), '#e9e4da', { outlineWidth: 0.04 });
      mast.position.z = MAST_Z;
      this.tilt.add(mast);

      const sailMat = toon('#ffffff', { map: sailTexture(label, accent), side: THREE.DoubleSide, flatShading: true });
      this.main = new Sail({
        luff0: new THREE.Vector3(0, 1.3, MAST_Z), luff1: new THREE.Vector3(0, 17.4, MAST_Z),
        leech0: new THREE.Vector3(0, 1.25, MAST_Z - 4.9), leech1: new THREE.Vector3(0, 17.2, MAST_Z - 1.1),
        material: sailMat,
      });
      this.tilt.add(this.main.mesh);
      const back = sailMat.map.clone();
      back.wrapS = THREE.RepeatWrapping;
      back.repeat.x = -1;
      back.needsUpdate = true;
      sailMat.side = THREE.FrontSide;
      this.main.mesh.add(new THREE.Mesh(this.main.geometry, toon('#ffffff', { map: back, side: THREE.BackSide, flatShading: true })));
      this.jib = new Sail({
        luff0: new THREE.Vector3(0, 0.95, L / 2 - 0.45), luff1: new THREE.Vector3(0, 13.2, MAST_Z + 0.2),
        leech0: new THREE.Vector3(0, 1.25, MAST_Z - 0.4), leech1: new THREE.Vector3(0, 13.2, MAST_Z + 0.1),
        segU: 3, segV: 6, material: toon(PALETTE.sail, { side: THREE.DoubleSide, flatShading: true }),
      });
      this.tilt.add(this.jib.mesh);

      navLights(this.tilt, { port: [1.5, 1.3, 4.4], starboard: [-1.5, 1.3, 4.4], mast: [0, 18.6, MAST_Z], size: 3.5 });
    }

    this.armPort = foilArm(1);
    this.armStbd = foilArm(-1);
    this.tilt.add(this.armPort, this.armStbd);

    const rudder = new THREE.Group();
    rudder.position.set(0, 0.4, -L / 2 + 0.35);
    const blade = solid(new THREE.BoxGeometry(0.09, 2.6, 0.45).translate(0, -1.1, 0), PALETTE.foil, { outlineWidth: 0.03 });
    const elevator = solid(new THREE.BoxGeometry(1.4, 0.07, 0.38), PALETTE.foil, { outlineWidth: 0.03 });
    elevator.position.y = -2.35;
    rudder.add(blade, elevator);
    rudder.userData.tip = new THREE.Object3D();
    rudder.userData.tip.position.y = -2.35;
    rudder.add(rudder.userData.tip);
    this.rudder = rudder;
    this.tilt.add(rudder);

    // État physique (arcade). Le vent vient du nord (-z) et souffle vers +z.
    this.pos = new THREE.Vector2(0, 0);
    this.heading = Math.PI / 2; // 0 = vers +z, π = vers le nord
    this.speed = 0;
    this.height = 0;
    this.foiling = false;
    this.side = 1;
    this.sideSmooth = 1;
    this.turn = 0;
    this.maxSpeed = 26;
  }

  get twa() { return Math.PI - Math.abs(wrap(this.heading)); }
  get forward() { return new THREE.Vector2(Math.sin(this.heading), Math.cos(this.heading)); }

  update(dt, input, collide) {
    const steer = THREE.MathUtils.clamp(input.steer, -1, 1);
    const grip = 0.45 + 0.55 * Math.min(this.speed / 14, 1);
    this.turn = THREE.MathUtils.damp(this.turn, steer, 6, dt);
    this.heading = wrap(this.heading + this.turn * 1.15 * grip * dt);

    const power = input.brake ? 0 : input.power; // sans commande, le bateau ralentit et s'arrête
    const target = this.maxSpeed * power * polar(this.twa);
    const rate = target > this.speed ? 0.55 : input.moor ? 3.5 : input.brake ? 1.6 : 0.6;
    this.speed += (target - this.speed) * Math.min(rate * dt, 1);

    // Virement ou empannage : le bras au vent change de côté et on perd un peu de vitesse.
    const side = Math.sign(Math.sin(this.heading)) || this.side;
    if (side !== this.side) {
      this.side = side;
      this.speed *= 0.86;
    }
    this.sideSmooth = THREE.MathUtils.damp(this.sideSmooth, this.side, 3, dt);

    if (!this.foiling && this.speed > 11) this.foiling = true;
    if (this.foiling && this.speed < 8) this.foiling = false;
    this.height = THREE.MathUtils.damp(this.height, this.foiling ? 1.5 : 0, this.foiling ? 2.2 : 3.5, dt);

    const f = this.forward;
    this.pos.addScaledVector(f, this.speed * dt * (this.travel ?? 1));
    if (collide) {
      const hit = collide(this.pos, 5);
      if (hit) this.speed *= Math.pow(0.15, dt * 4);
    }

    this.root.position.set(this.pos.x, this.height, this.pos.y);
    this.root.rotation.y = this.heading;
    const bob = this.foiling ? 0 : Math.sin(performance.now() * 0.002) * 0.04;
    // En vol on gîte au vent (côté +x = bâbord quand side > 0), en archimédien sous le vent.
    const heel = (this.foiling ? -0.1 : 0.05) * this.sideSmooth - this.turn * 0.12 * grip;
    this.tilt.rotation.z = THREE.MathUtils.damp(this.tilt.rotation.z, heel + bob, 4, dt);
    const pitch = this.foiling ? -0.02 : THREE.MathUtils.clamp((target - this.speed) * -0.004, -0.05, 0.05);
    this.tilt.rotation.x = THREE.MathUtils.damp(this.tilt.rotation.x, pitch, 3, dt);

    // Bras au vent relevé, bras sous le vent descendu (côté au vent = signe de sin(cap)).
    const portUp = this.sideSmooth > 0;
    this.armPort.rotation.z = THREE.MathUtils.damp(this.armPort.rotation.z, portUp ? 1.95 : 0.1, 3, dt);
    this.armStbd.rotation.z = THREE.MathUtils.damp(this.armStbd.rotation.z, portUp ? -0.1 : -1.95, 3, dt);
    this.rudder.rotation.y = -this.turn * 0.35;

    const trim = 0.06 + 0.4 * Math.pow(this.twa / Math.PI, 2);
    this.main?.update(this.sideSmooth, trim, 0.1);
    this.jib?.update(this.sideSmooth, trim * 0.85, 0.12);
  }

  // Points d'émission du sillage, en coordonnées monde.
  wakePoints(out) {
    out.length = 0;
    const v = new THREE.Vector3();
    if (this.height > 0.6) {
      const arm = this.sideSmooth > 0 ? this.armStbd : this.armPort;
      out.push(arm.userData.tip.getWorldPosition(v.clone()));
      out.push(this.rudder.userData.tip.getWorldPosition(v.clone()));
    } else {
      for (const s of [-1, 1]) {
        const p = new THREE.Vector3(s * 1.2, 0, -L / 2 + 0.2);
        out.push(this.tilt.localToWorld(p));
      }
    }
    return out;
  }
}
