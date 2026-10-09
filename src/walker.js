import * as THREE from 'three';
import { person } from './characters.js?v=20261009103817';

// Le marin à terre : on le dirige comme le bateau, mais relativement à l'écran (haut = nord).
export class Walker {
  constructor() {
    this.root = person({ shirt: '#ff6a4d', pants: '#26324a', skin: '#f2c9a0', hair: '#3a2618' });
    this.root.scale.setScalar(2.4);
    // Silhouette visible à travers les bâtiments. Elle est dessinée après le décor mais avant le personnage :
    // elle n'apparaît donc que là où un bâtiment le cache, jamais quand un bras passe devant le torse.
    const xray = new THREE.MeshBasicMaterial({ color: '#ff6a4d', depthWrite: false, depthFunc: THREE.GreaterDepth });
    const meshes = [];
    this.root.traverse((o) => { if (o.isMesh && !(o.material instanceof THREE.ShaderMaterial)) meshes.push(o); });
    // Les contours du personnage aussi passent après la silhouette (sinon ils la déclenchent en liseré).
    this.root.traverse((o) => { if (o.isMesh && o.material instanceof THREE.ShaderMaterial) o.renderOrder = 3; });
    for (const m of meshes) {
      m.renderOrder = 2;
      const ghost = new THREE.Mesh(m.geometry, xray);
      ghost.renderOrder = 1;
      m.add(ghost);
    }
    this.root.visible = false;
    this.pos = new THREE.Vector2();
    this.heading = Math.PI;
    this.speed = 0;
    this.y = 0;
    this.phase = 0;
  }

  // Tractions à la barre : on saute s'accrocher, on enchaîne les répétitions demandées, puis on redescend.
  startPull(bar) {
    if (this.pull && this.pull.stage !== 'drop') { this.pull.queued = Math.min(this.pull.queued + 1, this.pull.done + 3); return; }
    this.pull = { bar, stage: 'jump', t: 0, done: 0, queued: 1, from: this.pos.clone(), y0: this.y };
  }

  // Renvoie le nombre de tractions terminées pendant cette image. move = le visiteur reprend les commandes.
  updatePull(dt, move) {
    const p = this.pull, { legs, arms } = this.root.userData;
    const SCALE = 2.4, hangY = p.bar.y - 2.32 * SCALE; // mains sur la barre, bras tendus
    const UP = 0.5, TOP = 0.15, DOWN = 0.55, REST = 0.15, REP = UP + TOP + DOWN + REST;
    let k = 0, x = p.bar.x, z = p.bar.z, y = hangY, reps = 0;
    p.t += dt;
    if (move && p.stage !== 'drop') { p.stage = 'drop'; p.t = 0; }
    if (p.stage === 'jump') {
      const s = Math.min(p.t / 0.35, 1);
      x = THREE.MathUtils.lerp(p.from.x, p.bar.x, s); z = THREE.MathUtils.lerp(p.from.y, p.bar.z, s);
      y = THREE.MathUtils.lerp(p.y0, hangY, s) + Math.sin(s * Math.PI) * 0.8;
      arms.forEach((a) => { a.rotation.x = Math.PI * s; });
      if (s >= 1) { p.stage = 'reps'; p.t = 0; }
    } else if (p.stage === 'reps') {
      if (p.t < UP) k = THREE.MathUtils.smoothstep(p.t / UP, 0, 1);
      else if (p.t < UP + TOP) k = 1;
      else if (p.t < UP + TOP + DOWN) k = 1 - THREE.MathUtils.smoothstep((p.t - UP - TOP) / DOWN, 0, 1);
      if (!p.counted && p.t >= UP) { p.counted = true; p.done++; reps++; } // menton au-dessus de la barre
      if (p.t >= REP) {
        p.t = 0; p.counted = false;
        if (p.done >= p.queued) p.stage = 'hang';
      }
    } else if (p.stage === 'hang') {
      if (p.queued > p.done) { p.stage = 'reps'; p.t = 0; }
      else if (p.t > 1.2) { p.stage = 'drop'; p.t = 0; }
    } else if (p.stage === 'drop') {
      const s = Math.min(p.t / 0.35, 1);
      x = THREE.MathUtils.lerp(p.bar.x, p.from.x, s); z = THREE.MathUtils.lerp(p.bar.z, p.from.y, s);
      y = THREE.MathUtils.lerp(hangY, p.y0, s);
      arms.forEach((a) => { a.rotation.x = Math.PI * (1 - s); });
      legs.forEach((l) => { l.rotation.x = 0; });
      if (s >= 1) { this.pull = null; this.pos.copy(p.from); this.y = p.y0; }
    }
    if (p.stage === 'reps' || p.stage === 'hang') {
      // Le corps monte de la longueur d'un avant-bras ; les bras se plient pour garder les mains sur la barre.
      y = hangY + k * 0.72 * SCALE;
      arms.forEach((a) => { a.rotation.x = Math.acos(THREE.MathUtils.clamp(k - 1, -1, 1)); });
      legs.forEach((l) => { l.rotation.x = 0.2 + 0.35 * k; });
    }
    this.root.position.set(x, y, z);
    this.root.rotation.y = 0; // face à la caméra
    return reps;
  }

  place(x, z, world) {
    this.pos.set(x, z);
    this.y = world.groundY(x, z) ?? 0;
    this.speed = 0;
  }

  update(dt, input, world) {
    const move = new THREE.Vector2(input.x, input.z);
    const len = Math.min(move.length(), 1);
    const target = len * (input.run ? 30 : 16);
    this.speed = THREE.MathUtils.damp(this.speed, target, 10, dt);
    if (len > 0.05) {
      const want = Math.atan2(move.x, move.y);
      const err = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
      this.heading += err * Math.min(1, dt * 12);
    }
    const step = new THREE.Vector2(Math.sin(this.heading), Math.cos(this.heading)).multiplyScalar(this.speed * dt);
    // On glisse le long des bords : si le pas complet sort de la terre, on essaie chaque axe séparément.
    for (const s of [step, new THREE.Vector2(step.x, 0), new THREE.Vector2(0, step.y)]) {
      const nx = this.pos.x + s.x, nz = this.pos.y + s.y;
      if (world.walkable(nx, nz, 1.2)) { this.pos.set(nx, nz); break; }
    }
    this.y = THREE.MathUtils.damp(this.y, world.groundY(this.pos.x, this.pos.y) ?? this.y, 12, dt);

    this.phase += dt * this.speed * 0.55;
    const swing = Math.min(this.speed / 16, 1);
    const { legs, arms } = this.root.userData;
    legs.forEach((l, i) => { l.rotation.x = Math.sin(this.phase + i * Math.PI) * 0.8 * swing; });
    arms.forEach((a, i) => { a.rotation.x = -Math.sin(this.phase + i * Math.PI) * 0.7 * swing; });
    this.root.position.set(this.pos.x, this.y + Math.abs(Math.sin(this.phase)) * 0.3 * swing, this.pos.y);
    this.root.rotation.y = this.heading;
  }
}
