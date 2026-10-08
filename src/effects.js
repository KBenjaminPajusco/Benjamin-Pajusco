import * as THREE from 'three';
import { PALETTE } from './toon.js?v=20261008151501';

const MAX_SHORE = 32;

// Eau stylisée : aplats de deux bleus, tirets d'écume, et ourlet d'écume animé autour des obstacles.
export function makeWater(shores, boxes, segs = [], tints = [], poly = []) {
  const MAXP = 96;
  const polyPts = new Array(MAXP).fill(0).map((_, i) => (poly[i] ? new THREE.Vector2(poly[i].x, poly[i].y) : new THREE.Vector2(1e5, 1e5)));
  const circles = new Array(MAX_SHORE).fill(0).map(() => new THREE.Vector3(1e5, 1e5, 0));
  shores.slice(0, MAX_SHORE).forEach((s, i) => circles[i].set(s.x, s.z, s.r));
  const rects = new Array(4).fill(0).map(() => new THREE.Vector4(1e5, 1e5, 0, 0));
  boxes.slice(0, 4).forEach((b, i) => rects[i].set(b.x, b.z, b.hx, b.hz));
  const segments = new Array(4).fill(0).map(() => new THREE.Vector4(1e5, 1e5, 1e5, 1e5));
  segs.slice(0, 4).forEach((g, i) => segments[i].set(g[0], g[1], g[2], g[3]));
  // Teintes régionales (ex. la Méditerranée autour de Naples) : x, z, rayon + couleur.
  const tintPos = [0, 1].map((i) => (tints[i] ? new THREE.Vector3(tints[i].x, tints[i].z, tints[i].r) : new THREE.Vector3(1e5, 1e5, 1)));
  const tintCol = [0, 1].map((i) => new THREE.Color(tints[i]?.color || '#000000'));

  // Champ de distance au rivage (îles, quai, digues, bouées), calculé une seule fois sur le CPU.
  const FIELD = { x0: -620, z0: -620, size: 1240, res: 512, max: 40 };
  const data = new Uint8Array(FIELD.res * FIELD.res * 2); // R : terre, G : bouées
  const segDist = (px, pz, ax, az, bx, bz) => {
    const abx = bx - ax, abz = bz - az;
    const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz || 1)));
    return Math.hypot(px - ax - abx * t, pz - az - abz * t);
  };
  const near = (cx, cz, r) => (px, pz) => Math.abs(px - cx) < r + FIELD.max && Math.abs(pz - cz) < r + FIELD.max;
  const landCircles = shores.filter((c) => c.r > 0), buoyCircles = shores.filter((c) => c.r < 0);
  const polyB = poly.length ? poly.reduce((b, p) => ({ x0: Math.min(b.x0, p.x), x1: Math.max(b.x1, p.x), z0: Math.min(b.z0, p.y), z1: Math.max(b.z1, p.y) }), { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 }) : null;
  for (let j = 0; j < FIELD.res; j++) {
    const pz = FIELD.z0 + ((j + 0.5) / FIELD.res) * FIELD.size;
    for (let i = 0; i < FIELD.res; i++) {
      const px = FIELD.x0 + ((i + 0.5) / FIELD.res) * FIELD.size;
      let d = FIELD.max, db = FIELD.max;
      for (const c of landCircles) if (near(c.x, c.z, c.r)(px, pz)) d = Math.min(d, Math.hypot(px - c.x, pz - c.z) - c.r);
      for (const c of buoyCircles) if (near(c.x, c.z, -c.r)(px, pz)) db = Math.min(db, Math.hypot(px - c.x, pz - c.z) + c.r);
      for (const b of boxes) {
        const qx = Math.abs(px - b.x) - b.hx, qz = Math.abs(pz - b.z) - b.hz;
        d = Math.min(d, Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0));
      }
      for (const g of segs) d = Math.min(d, segDist(px, pz, g[0], g[1], g[2], g[3]) - 3.5);
      if (polyB && px > polyB.x0 - FIELD.max && px < polyB.x1 + FIELD.max && pz > polyB.z0 - FIELD.max && pz < polyB.z1 + FIELD.max) {
        for (let k = 0; k < poly.length; k++) {
          const p = poly[k], q = poly[(k + 1) % poly.length];
          d = Math.min(d, segDist(px, pz, p.x, p.y, q.x, q.y));
        }
      }
      const o = (j * FIELD.res + i) * 2;
      data[o] = Math.round(THREE.MathUtils.clamp(d, 0, FIELD.max) / FIELD.max * 255);
      data[o + 1] = Math.round(THREE.MathUtils.clamp(db, 0, FIELD.max) / FIELD.max * 255);
    }
  }
  const distTex = new THREE.DataTexture(data, FIELD.res, FIELD.res, THREE.RGFormat, THREE.UnsignedByteType);
  distTex.minFilter = distTex.magFilter = THREE.LinearFilter;
  distTex.needsUpdate = true;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSea: { value: new THREE.Color(PALETTE.sea) },
      uDeep: { value: new THREE.Color('#3591c7') },
      uShallow: { value: new THREE.Color('#6cc6dc') },
      uFoam: { value: new THREE.Color(PALETTE.foam) },
      uCircles: { value: circles },
      uRects: { value: rects },
      uSegs: { value: segments },
      uTintPos: { value: tintPos },
      uTintCol: { value: tintCol },
      uDist: { value: distTex },
      uField: { value: new THREE.Vector4(FIELD.x0, FIELD.z0, FIELD.size, FIELD.max) },
    },
    vertexShader: /* glsl */`
      varying vec2 vP;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vP = w.xz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uSea, uDeep, uShallow, uFoam;
      uniform vec3 uCircles[${MAX_SHORE}];
      uniform vec4 uRects[4];
      uniform vec4 uSegs[4];
      uniform vec3 uTintPos[2];
      uniform vec3 uTintCol[2];
      uniform sampler2D uDist;
      uniform vec4 uField;
      varying vec2 vP;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      void main() {
        // Distance au rivage lue dans le champ précalculé (R : terre, G : bouées).
        vec2 dist = texture2D(uDist, (vP - uField.xy) / uField.z).rg * uField.w;
        float d = dist.r, dBuoy = dist.g;
        if (abs(vP.x) > 610.0 || abs(vP.y) > 610.0) { d = uField.w; dBuoy = uField.w; }
        float n = noise(vP * 0.012 + vec2(uTime * 0.02, uTime * 0.035)) * 0.65 + noise(vP * 0.04 - uTime * 0.05) * 0.35;
        vec3 col = mix(uDeep, uSea, step(0.42, n));
        for (int i = 0; i < 2; i++) {
          float k = 1.0 - smoothstep(uTintPos[i].z * 0.55, uTintPos[i].z, length(vP - uTintPos[i].xy));
          col = mix(col, uTintCol[i] * (0.86 + 0.14 * step(0.42, n)), k);
        }
        float dash = noise(vec2(vP.x * 0.5, vP.y * 0.12 - uTime * 0.8));
        col = mix(col, uFoam, step(0.93, dash) * step(0.55, noise(vP * 0.03)) * 0.4);
        float shallowW = 9.0 + noise(vP * 0.1) * 4.0;
        col = mix(col, uShallow, step(d, shallowW));
        float ring = fract((d - uTime * 2.2) / 5.0);
        float foam = step(d, 6.0) * step(ring, 0.22) + step(d, 1.6 + noise(vP * 0.4 + uTime) * 1.2)
                   + step(dBuoy, 0.6 + noise(vP * 0.6 + uTime * 2.0) * 0.8);
        col = mix(col, uFoam, clamp(foam, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), mat);
  water.receiveShadow = false;

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ color: '#0b3550', opacity: 0.28 }));
  shadow.position.y = 0.03;
  shadow.receiveShadow = true;

  const group = new THREE.Group();
  group.add(water, shadow);
  return {
    group,
    update: (t) => { mat.uniforms.uTime.value = t; },
    // Couleurs de la mer selon l'heure (jour, aube, nuit…).
    setPalette: (sea, deep, shallow) => {
      mat.uniforms.uSea.value.copy(sea);
      mat.uniforms.uDeep.value.copy(deep);
      mat.uniforms.uShallow.value.copy(shallow);
    },
  };
}

// Sillage et embruns : un nuage de points dont chaque point vit, grossit et s'efface.
export class Wake {
  constructor(count = 900) {
    this.count = count;
    this.cursor = 0;
    this.pos = new Float32Array(count * 3).fill(1e5);
    this.life = new Float32Array(count);
    this.size = new Float32Array(count);
    this.vel = new Float32Array(count * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geometry = g;
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: { value: 1 } },
      vertexShader: /* glsl */`
        attribute float aLife; attribute float aSize; varying float vLife; uniform float uScale;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (1.0 + (1.0 - aLife) * 1.6) * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying float vLife;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          if (r > 0.5 || vLife <= 0.0) discard;
          gl_FragColor = vec4(1.0, 1.0, 1.0, step(0.25, vLife) * 0.9);
        }`,
    }));
    this.points.frustumCulled = false;
    this.acc = 0;
  }
  emit(p, size, vx = 0, vz = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.count;
    this.pos[i * 3] = p.x + (Math.random() - 0.5) * 0.6;
    this.pos[i * 3 + 1] = 0.08;
    this.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 0.6;
    this.life[i] = 1;
    this.size[i] = size;
    this.vel[i * 2] = vx; this.vel[i * 2 + 1] = vz;
  }
  update(dt, emitters, speed, foiling, viewportScale) {
    this.points.material.uniforms.uScale.value = viewportScale;
    this.acc += dt * (4 + speed * 1.4);
    while (this.acc > 1 && speed > 0.8) {
      this.acc -= 1;
      for (const e of emitters) this.emit(e, foiling ? 0.6 : 1.0, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
    }
    if (speed <= 0.8) this.acc = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt * 0.6;
      this.pos[i * 3] += this.vel[i * 2] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 2 + 1] * dt;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aLife.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
  }
}

// Gerbes des foils (« foil wash ») : là où le foil et le safran percent la surface, l'eau est projetée
// vers le haut et vers l'arrière puis retombe. Plus le bateau va vite, plus la gerbe est haute et dense.
export class FoilSpray {
  constructor(count = 1400) {
    this.count = count;
    this.cursor = 0;
    this.pos = new Float32Array(count * 3).fill(1e5);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.size = new Float32Array(count);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geometry = g;
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: { value: 1 } },
      vertexShader: /* glsl */`
        attribute float aLife; attribute float aSize; varying float vLife; uniform float uScale;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (0.6 + (1.0 - aLife) * 0.9) * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying float vLife;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          if (r > 0.5 || vLife <= 0.0) discard;
          gl_FragColor = vec4(1.0, 1.0, 1.0, min(1.0, vLife * 1.6) * 0.85);
        }`,
    }));
    this.points.frustumCulled = false;
    this.acc = new WeakMap();
  }
  // Une source par bateau : points de perçage (monde), cap (vecteur avant x/z), vitesse en m/s.
  feed(dt, key, sources, fwd, speed) {
    if (speed < 9 || !sources.length) { this.acc.set(key, 0); return; }
    const k = Math.min((speed - 9) / 12, 1.4); // 0 au décollage → gerbe pleine vers 40 nds
    let acc = (this.acc.get(key) || 0) + dt * (30 + 110 * k);
    while (acc > 1) {
      acc -= 1;
      for (const p of sources) {
        const i = this.cursor;
        this.cursor = (this.cursor + 1) % this.count;
        const side = (Math.random() - 0.5) * 2;
        this.pos[i * 3] = p.x + (Math.random() - 0.5) * 0.3;
        this.pos[i * 3 + 1] = 0.15;
        this.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 0.3;
        // Vers l'arrière (traînée), un peu sur les côtés, et vers le haut : une queue de coq.
        const back = speed * (0.25 + Math.random() * 0.2);
        this.vel[i * 3] = -fwd.x * back + fwd.y * side * 2.2;
        this.vel[i * 3 + 1] = (2.5 + Math.random() * 3.5) * (0.6 + k);
        this.vel[i * 3 + 2] = -fwd.y * back - fwd.x * side * 2.2;
        this.life[i] = 1;
        this.size[i] = 0.35 + Math.random() * 0.45;
      }
    }
    this.acc.set(key, acc);
  }
  update(dt, viewportScale) {
    this.points.material.uniforms.uScale.value = viewportScale;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt * 1.1;
      this.vel[i * 3 + 1] -= 9.8 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0) this.life[i] = 0; // retombée dans l'eau
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aLife.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
  }
}

// Traits de vent qui glissent sur l'eau dans le sens du vent (du nord vers le sud).
export class WindStreaks {
  constructor(count = 46) {
    this.group = new THREE.Group();
    this.items = [];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, 1).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }),
      );
      m.position.y = 0.2;
      this.group.add(m);
      this.items.push({ m, life: Math.random(), len: 10 + Math.random() * 14 });
    }
  }
  update(dt, center) {
    for (const it of this.items) {
      it.life += dt * 0.35;
      if (it.life >= 1) {
        it.life = 0;
        it.m.position.x = center.x + (Math.random() - 0.5) * 320;
        it.m.position.z = center.z + (Math.random() - 0.5) * 220 - 40;
        it.len = 10 + Math.random() * 16;
      }
      it.m.position.z += dt * 16;
      it.m.scale.z = it.len * Math.sin(it.life * Math.PI);
      it.m.material.opacity = 0.3 * Math.sin(it.life * Math.PI);
    }
  }
}
