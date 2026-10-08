import * as THREE from 'three';
import { toon } from './toon.js?v=20261008151147';
import { LAMP, NAV } from './island.js?v=20261008151147';

// Lumière calée sur l'heure locale du visiteur : nuit, aube, jour, coucher de soleil.
// Pour tester une heure précise : ?heure=21.5
const KEYS = [
  { h: 0, sun: 0.8, sunC: '#b4c6ee', sky: '#7d91c4', gnd: '#2a3d63', hemi: 1.15, bg: '#16305a', sea: '#2a6a9c', deep: '#225c8a', shallow: '#3e88a8', night: 1 },
  { h: 5.5, sun: 0.8, sunC: '#b4c6ee', sky: '#7d91c4', gnd: '#2a3d63', hemi: 1.15, bg: '#16305a', sea: '#2a6a9c', deep: '#225c8a', shallow: '#3e88a8', night: 1 },
  { h: 7, sun: 1.6, sunC: '#ffc9a0', sky: '#ffd8c0', gnd: '#5d7fa0', hemi: 1.05, bg: '#3f86b8', sea: '#3a8fc0', deep: '#2f7aad', shallow: '#64b9d4', night: 0.25 },
  { h: 9, sun: 2.4, sunC: '#fff4e0', sky: '#ffffff', gnd: '#7fb8d8', hemi: 1.4, bg: '#2c7fb8', sea: '#3f9fd1', deep: '#3591c7', shallow: '#6cc6dc', night: 0 },
  { h: 17.5, sun: 2.4, sunC: '#fff4e0', sky: '#ffffff', gnd: '#7fb8d8', hemi: 1.4, bg: '#2c7fb8', sea: '#3f9fd1', deep: '#3591c7', shallow: '#6cc6dc', night: 0 },
  { h: 19.5, sun: 1.5, sunC: '#ff9a5a', sky: '#ffc49a', gnd: '#55709a', hemi: 1.0, bg: '#2f6f9f', sea: '#367fb0', deep: '#2c6c9a', shallow: '#5aa8c4', night: 0.35 },
  { h: 21.5, sun: 0.8, sunC: '#b4c6ee', sky: '#7d91c4', gnd: '#2a3d63', hemi: 1.15, bg: '#16305a', sea: '#2a6a9c', deep: '#225c8a', shallow: '#3e88a8', night: 1 },
  { h: 24, sun: 0.8, sunC: '#b4c6ee', sky: '#7d91c4', gnd: '#2a3d63', hemi: 1.15, bg: '#16305a', sea: '#2a6a9c', deep: '#225c8a', shallow: '#3e88a8', night: 1 },
];
const COLOR_KEYS = ['sunC', 'sky', 'gnd', 'bg', 'sea', 'deep', 'shallow'];
const override = parseFloat(new URLSearchParams(location.search).get('heure'));

export function currentHour() {
  if (!Number.isNaN(override)) return override;
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

const ca = new THREE.Color(), cb = new THREE.Color();
export function paramsAt(hour) {
  let i = 0;
  while (i < KEYS.length - 2 && hour >= KEYS[i + 1].h) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const k = THREE.MathUtils.clamp((hour - a.h) / (b.h - a.h), 0, 1);
  const out = { sun: THREE.MathUtils.lerp(a.sun, b.sun, k), hemi: THREE.MathUtils.lerp(a.hemi, b.hemi, k), night: THREE.MathUtils.lerp(a.night, b.night, k) };
  for (const key of COLOR_KEYS) out[key] = ca.set(a[key]).lerp(cb.set(b[key]), k).clone();
  return out;
}

// Fenêtres des maisons : même matériau partagé (couleur dédiée), qui s'allume la nuit.
export const WINDOW_COLOR = '#4aa4de';

export function applyDayNight({ scene, sun, hemi, water, beam }, hour) {
  const p = paramsAt(hour);
  sun.intensity = p.sun;
  sun.color.copy(p.sunC);
  hemi.intensity = p.hemi;
  hemi.color.copy(p.sky);
  hemi.groundColor.copy(p.gnd);
  scene.background.copy(p.bg);
  water.setPalette(p.sea, p.deep, p.shallow);
  LAMP.glow.opacity = p.night * 0.9;
  LAMP.bulb.color.set(p.night > 0.3 ? '#ffe2a0' : '#f4f1ea');
  const win = toon(WINDOW_COLOR, { flatShading: true });
  win.emissive.set('#ffc56b').multiplyScalar(p.night * 0.9);
  // Bandeaux vitrés des bâtiments (bureaux, écoles, K-Challenge…) : éclairés de l'intérieur la nuit.
  toon('#4aa3df', { flatShading: true }).emissive.set('#9fd8ff').multiplyScalar(p.night * 0.55);
  for (const m of Object.values(NAV)) m.opacity = p.night;
  if (beam) beam.material.opacity = 0.12 + p.night * 0.3;
  return p;
}
