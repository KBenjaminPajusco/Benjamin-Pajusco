import * as THREE from 'three';
import { solid, toon, PALETTE } from './toon.js?v=20261008134250';
import { person } from './characters.js?v=20261008134250';
import { navLights } from './island.js?v=20261008134250';

// Semi-rigide à moteur pour les visiteurs qui ne naviguent pas : il se conduit comme une voiture,
// sans vent ni réglage. Même interface que Boat (pos, heading, speed, update, wakePoints…).
const L = 6.2;

function tubeGeometry() {
  // Boudin en U : de l'arrière bâbord, autour de l'étrave, jusqu'à l'arrière tribord.
  const pts = [
    [1.15, -L / 2], [1.25, -0.8], [1.2, 1.2], [0.85, 2.5], [0, 3.15], [-0.85, 2.5], [-1.2, 1.2], [-1.25, -0.8], [-1.15, -L / 2],
  ].map(([x, z]) => new THREE.Vector3(x, 0.55, z));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.42, 7, false);
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Rib {
  constructor() {
    this.root = new THREE.Group();
    this.tilt = new THREE.Group();
    this.root.add(this.tilt);
    const body = new THREE.Group();
    body.scale.setScalar(1.45); // un peu plus gros que nature pour rester lisible de haut
    this.tilt.add(body);

    body.add(solid(tubeGeometry(), '#3c4a5c', { outlineWidth: 0.05 }));
    // Liseré orange sur le boudin et coque blanche dessous.
    const strake = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      [1.5, -L / 2 + 0.2], [1.6, 0], [1.3, 2.2], [0, 3.5], [-1.3, 2.2], [-1.6, 0], [-1.5, -L / 2 + 0.2],
    ].map(([x, z]) => new THREE.Vector3(x * 0.82, 0.62, z * 0.97))), 24, 0.12, 5, false);
    body.add(solid(strake, PALETTE.accent, { outlineWidth: 0 }));
    const shape = new THREE.Shape();
    shape.moveTo(0, 3.0);
    shape.quadraticCurveTo(1.1, 2.2, 1.0, -L / 2 + 0.1);
    shape.lineTo(-1.0, -L / 2 + 0.1);
    shape.quadraticCurveTo(-1.1, 2.2, 0, 3.0);
    body.add(solid(new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false, curveSegments: 6 }).rotateX(Math.PI / 2).translate(0, 0.55, 0), '#f6f1e7', { outlineWidth: 0.04 }));

    // Console de pilotage, pare-brise, volant et pilote.
    body.add(solid(new THREE.BoxGeometry(0.9, 1.0, 0.8).translate(0, 1.0, 0.2), '#f6f1e7', { outlineWidth: 0.04 }));
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.5, 0.05).rotateX(-0.4).translate(0, 1.7, 0.55), new THREE.MeshBasicMaterial({ color: '#bfe9f5', transparent: true, opacity: 0.6 }));
    body.add(glass);
    const wheel = solid(new THREE.TorusGeometry(0.22, 0.04, 5, 10).rotateX(-0.6).translate(0, 1.55, -0.1), '#1d2533', { outlineWidth: 0 });
    body.add(wheel);
    this.wheel = wheel;
    const pilot = person({ shirt: '#ffc845', pants: '#26324a' });
    pilot.scale.setScalar(0.85);
    pilot.position.set(0, 0.6, -0.75);
    pilot.userData.arms.forEach((a) => { a.rotation.x = -1.1; });
    body.add(pilot);

    body.add(solid(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 4).translate(0, 1.6, -2.6), '#9aa3ad', { outlineWidth: 0 }));
    navLights(body, { port: [1.15, 1.1, 2.0], starboard: [-1.15, 1.1, 2.0], mast: [0, 2.5, -2.6], size: 2.2 });

    // Moteur hors-bord.
    const engine = new THREE.Group();
    engine.position.set(0, 0.6, -L / 2 - 0.15);
    engine.add(solid(new THREE.BoxGeometry(0.55, 0.75, 0.6).translate(0, 0.55, -0.1), '#1d2533', { outlineWidth: 0.04 }));
    engine.add(solid(new THREE.BoxGeometry(0.18, 0.9, 0.25).translate(0, -0.25, -0.1), '#55607a', { outlineWidth: 0.03 }));
    body.add(engine);
    this.engine = engine;

    this.pos = new THREE.Vector2();
    this.heading = Math.PI / 2;
    this.speed = 0;
    this.height = 0;
    this.foiling = false;
    this.turn = 0;
    this.maxSpeed = 19;
    this.motor = true;
  }

  // Le cap par rapport au vent n'a pas de sens au moteur, mais la télémétrie l'enregistre quand même.
  get twa() { return Math.PI - Math.abs(wrap(this.heading)); }
  get forward() { return new THREE.Vector2(Math.sin(this.heading), Math.cos(this.heading)); }

  update(dt, input, collide) {
    const steer = THREE.MathUtils.clamp(input.steer, -1, 1);
    this.turn = THREE.MathUtils.damp(this.turn, steer, 8, dt);
    const grip = 0.35 + 0.65 * Math.min(this.speed / 8, 1);
    this.heading = wrap(this.heading + this.turn * 1.7 * grip * dt);

    const target = input.brake ? 0 : this.maxSpeed * (input.power > 0 ? input.power : 0);
    const rate = target > this.speed ? 0.9 : input.moor ? 3.5 : input.brake ? 2.2 : 0.7;
    const prev = this.speed;
    this.speed += (target - this.speed) * Math.min(rate * dt, 1);

    this.pos.addScaledVector(this.forward, this.speed * dt * (this.travel ?? 1));
    if (collide && collide(this.pos, 4)) this.speed *= Math.pow(0.15, dt * 4);

    this.root.position.set(this.pos.x, 0, this.pos.y);
    this.root.rotation.y = this.heading;
    // Déjaugeage : l'étrave se lève à l'accélération puis le bateau se cale à plat en planant.
    const accel = (this.speed - prev) / Math.max(dt, 1e-3);
    const pitch = -THREE.MathUtils.clamp(accel * 0.012, -0.04, 0.1) - (this.speed > 8 ? 0.02 : 0);
    this.tilt.rotation.x = THREE.MathUtils.damp(this.tilt.rotation.x, pitch, 4, dt);
    this.tilt.rotation.z = THREE.MathUtils.damp(this.tilt.rotation.z, -this.turn * 0.12 * grip, 5, dt);
    this.tilt.position.y = Math.sin(performance.now() * 0.003) * 0.05;
    this.wheel.rotation.z = -this.turn * 1.2;
    this.engine.rotation.y = this.turn * 0.4;
  }

  wakePoints(out) {
    out.length = 0;
    for (const s of [-1, 1]) out.push(this.tilt.localToWorld(new THREE.Vector3(s * 1.1, 0, -L / 2 * 1.45)));
    return out;
  }
}
