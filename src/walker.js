import * as THREE from 'three';
import { person } from './characters.js';

// Le marin à terre : on le dirige comme le bateau, mais relativement à l'écran (haut = nord).
export class Walker {
  constructor() {
    this.root = person({ shirt: '#ff6a4d', pants: '#26324a' });
    this.root.scale.setScalar(2.4);
    const xray = new THREE.MeshBasicMaterial({ color: '#ff6a4d', transparent: true, opacity: 0.85, depthWrite: false, depthFunc: THREE.GreaterDepth });
    const meshes = [];
    this.root.traverse((o) => { if (o.isMesh && !(o.material instanceof THREE.ShaderMaterial)) meshes.push(o); });
    for (const m of meshes) {
      const ghost = new THREE.Mesh(m.geometry, xray);
      ghost.renderOrder = 10;
      m.add(ghost);
    }
    this.root.visible = false;
    this.pos = new THREE.Vector2();
    this.heading = Math.PI;
    this.speed = 0;
    this.y = 0;
    this.phase = 0;
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
