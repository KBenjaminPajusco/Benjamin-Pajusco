import * as THREE from 'three';
import { solid } from './toon.js';

// Personnages low poly : marins, coureurs, agents IA (tête-écran).
export function person({ shirt = '#ff6a4d', skin = '#f2c9a0', pants = '#2d3a4f', agent = false } = {}) {
  const g = new THREE.Group();
  const w = 0.04;
  const leg = (s) => {
    const p = new THREE.Group();
    p.position.set(s * 0.17, 0.9, 0);
    p.add(solid(new THREE.BoxGeometry(0.22, 0.9, 0.26).translate(0, -0.45, 0), pants, { outlineWidth: w }));
    g.add(p);
    return p;
  };
  const arm = (s) => {
    const p = new THREE.Group();
    p.position.set(s * 0.42, 1.6, 0);
    p.add(solid(new THREE.BoxGeometry(0.17, 0.72, 0.17).translate(0, -0.36, 0), agent ? '#cfd6e0' : skin, { outlineWidth: w }));
    g.add(p);
    return p;
  };
  g.userData.legs = [leg(-1), leg(1)];
  g.userData.arms = [arm(-1), arm(1)];
  g.add(solid(new THREE.BoxGeometry(0.66, 0.76, 0.36).translate(0, 1.3, 0), shirt, { outlineWidth: w }));
  if (agent) {
    const head = solid(new THREE.BoxGeometry(0.62, 0.48, 0.46).translate(0, 1.96, 0), '#e9edf2', { outlineWidth: w });
    g.add(head);
    const screen = solid(new THREE.BoxGeometry(0.5, 0.34, 0.02).translate(0, 1.96, 0.235), '#1d2533', { outlineWidth: 0 });
    g.add(screen);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.02), new THREE.MeshBasicMaterial({ color: '#5ff2ff' }));
      eye.position.set(s * 0.11, 1.98, 0.25);
      g.add(eye);
    }
    const ant = solid(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4).translate(0, 2.35, 0), '#9aa3ad', { outlineWidth: 0 });
    g.add(ant);
  } else {
    g.add(solid(new THREE.IcosahedronGeometry(0.24, 0).translate(0, 1.95, 0), skin, { outlineWidth: w }));
  }
  return g;
}
