import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Fusion du décor immobile : tout ce qui n'a pas bougé pendant les premières secondes est cuit
// en un seul maillage par matériau (des milliers d'appels de dessin → quelques centaines).
// On repère l'immobilité en comparant les matrices monde à plusieurs instants.

export class StaticMerger {
  constructor(scene, { exclude = [] } = {}) {
    this.scene = scene;
    this.exclude = new Set(exclude);
    this.samples = null;
    this.moving = new Set();
    this.done = false;
  }

  // Appelé à chaque image avec le temps de simulation ; renvoie true une fois la fusion faite.
  update(t) {
    if (this.done) return true;
    if (t < 0.6) return false;
    if (!this.samples) {
      this.samples = new Map();
      this.scene.updateMatrixWorld(true);
      this.scene.traverse((o) => { if (o.isMesh) this.samples.set(o, { m: o.matrixWorld.clone(), v: this.visible(o) }); });
      this.nextCheck = t + 0.7;
      return false;
    }
    if (t >= this.nextCheck) {
      this.scene.updateMatrixWorld(true);
      for (const [o, s] of this.samples) {
        if (!o.matrixWorld.equals(s.m) || this.visible(o) !== s.v) this.moving.add(o);
      }
      this.nextCheck = t + 0.7;
      if (t > 7) this.merge();
    }
    return this.done;
  }

  visible(o) {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  }

  excluded(o) {
    for (let p = o; p; p = p.parent) {
      if (this.exclude.has(p) || p.userData?.dynamic) return true;
    }
    return false;
  }

  merge() {
    this.done = true;
    const groups = new Map();
    for (const [o] of this.samples) {
      if (this.moving.has(o) || this.excluded(o) || !this.visible(o) || o.isInstancedMesh || o.isSkinnedMesh) continue;
      if (Array.isArray(o.material)) continue; // matériaux multiples (coque) : laissés tels quels
      if (o.parent?.isMesh && this.moving.has(o.parent)) continue;
      const key = o.material.uuid;
      if (!groups.has(key)) groups.set(key, { material: o.material, items: [] });
      groups.get(key).items.push(o);
    }
    let removed = 0, created = 0;
    for (const { material, items } of groups.values()) {
      if (items.length < 2) continue;
      const needUv = !!material.map;
      const geos = [];
      for (const o of items) {
        let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        for (const name of Object.keys(g.attributes)) {
          if (name !== 'position' && name !== 'normal' && !(needUv && name === 'uv') && name !== 'color') g.deleteAttribute(name);
        }
        if (!g.attributes.normal) g.computeVertexNormals();
        g.applyMatrix4(o.matrixWorld);
        geos.push(g);
      }
      // Les attributs doivent être identiques pour fusionner : on regroupe par signature.
      const bySig = new Map();
      geos.forEach((g, i) => {
        const sig = Object.keys(g.attributes).sort().join(',');
        if (!bySig.has(sig)) bySig.set(sig, { geos: [], items: [] });
        bySig.get(sig).geos.push(g);
        bySig.get(sig).items.push(items[i]);
      });
      for (const { geos: gs, items: its } of bySig.values()) {
        if (gs.length < 2) continue;
        const merged = mergeGeometries(gs, false);
        if (!merged) continue;
        const mesh = new THREE.Mesh(merged, material);
        mesh.castShadow = its.some((o) => o.castShadow);
        mesh.receiveShadow = its.some((o) => o.receiveShadow);
        mesh.matrixAutoUpdate = false;
        mesh.userData.mergeRoot = true;
        this.scene.add(mesh);
        created++;
        for (const o of its) {
          // On masque seulement ce maillage (calque non rendu), pas ses enfants : un enfant non fusionné reste visible.
          o.layers.set(31);
          o.userData.merged = true;
          removed++;
        }
      }
    }
    // Les sous-arbres entièrement fusionnés (maillages cuits + simples groupes) sont retirés de la scène :
    // plus de calcul de matrices ni de parcours au rendu pour ces milliers d'objets devenus inutiles.
    const pure = new Map();
    const isPure = (o) => {
      if (pure.has(o)) return pure.get(o);
      // Un repère vide (bout de foil, point d'ancrage…) n'est jamais retiré : seul le décor réellement cuit l'est.
      const ok = o.isMesh
        ? !!o.userData.merged && o.children.every(isPure)
        : (o.type === 'Group' || o.type === 'Object3D') && !this.excluded(o) && o.children.length > 0 && o.children.every(isPure);
      pure.set(o, ok);
      return ok;
    };
    const detach = [];
    const walk = (o) => {
      for (const c of o.children) {
        if (c.userData.mergeRoot) continue;
        if (isPure(c)) detach.push(c);
        else walk(c);
      }
    };
    walk(this.scene);
    for (const o of detach) o.removeFromParent();
    this.scene.traverse((o) => { if (o.userData.merged) o.matrixAutoUpdate = false; });
    this.stats = { removed, created, detached: detach.length };
  }
}
