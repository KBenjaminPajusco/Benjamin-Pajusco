import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Rampe 3 tons partagée : c'est elle qui donne le rendu cel shading.
const gradient = (() => {
  const data = new Uint8Array([90, 170, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

const cache = new Map();

export function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!opts.map && cache.has(key)) return cache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...opts });
  if (!opts.map) cache.set(key, m);
  return m;
}

const outlineMats = new Map();
function outlineMaterial(thickness, color) {
  const key = thickness + ':' + color;
  if (outlineMats.has(key)) return outlineMats.get(key);
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uThick: { value: thickness } },
    vertexShader: /* glsl */`
      uniform float uThick;
      void main() {
        vec3 p = position + normal * uThick;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      void main() { gl_FragColor = vec4(uColor, 1.0); }`,
    side: THREE.BackSide,
  });
  outlineMats.set(key, m);
  return m;
}

// Contour "inverted hull" : on gonfle une copie de la géométrie le long de normales lissées.
export function outline(mesh, thickness = 0.06, color = '#1d2533') {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', mesh.geometry.getAttribute('position').clone());
  if (mesh.geometry.index) g.setIndex(mesh.geometry.index.clone());
  const merged = mergeVertices(g, 1e-3);
  merged.computeVertexNormals();
  const o = new THREE.Mesh(merged, outlineMaterial(thickness, color));
  o.castShadow = false;
  o.receiveShadow = false;
  mesh.add(o);
  return o;
}

// Mesh toon avec ombres et contour en un appel.
export function solid(geometry, color, { outlineWidth = 0.06, flat = true, cast = true, receive = true } = {}) {
  const mat = toon(color, flat ? { flatShading: true } : {});
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (outlineWidth > 0) outline(mesh, outlineWidth);
  return mesh;
}

// Petit PRNG déterministe : le monde est identique à chaque visite.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PALETTE = {
  sea: '#3f9fd1',
  seaDeep: '#2c7fb8',
  foam: '#f4fbff',
  sand: '#f1d8a6',
  grass: '#8cc56b',
  grassDark: '#5f9e4f',
  rock: '#9aa3ad',
  wood: '#a8754b',
  hull: '#f6f1e7',
  deck: '#dfe4ea',
  accent: '#ff6a4d',
  sail: '#fbf6ea',
  foil: '#2b3240',
  stage: '#ffc845',
  job: '#ff6a4d',
  sport: '#4d7cff',
};
