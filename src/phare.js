import * as THREE from 'three';
import { solid, toon, PALETTE } from './toon.js?v=20261009171854';
import { SKILLS } from './cv.js?v=20261009171854';

// Le Phare des maîtrises : un phare bâti comme l'icône d'une base de données (disques empilés).
// Le bateau lui envoie sa télémétrie quand il s'approche, et des câbles de données le relient au monde.
export function buildPhare({ root, anim, labels, circles, map, zones, at, links }) {
  const { x, z } = at;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  root.add(g);

  // Îlot rocheux.
  g.add(solid(new THREE.CylinderGeometry(15, 17, 2.6, 10).translate(0, -0.7, 0), PALETTE.sand, { outlineWidth: 0.2 }));
  g.add(solid(new THREE.CylinderGeometry(11, 13, 1.4, 9).translate(0, 1.2, 0), PALETTE.rock, { outlineWidth: 0.18 }));
  circles.push({ x, z, r: 17 });
  map.islands.push({ x, z, r: 16 });

  // Trois « disques » de base de données, séparés par des liserés cyan.
  const NAVY = '#14275b';
  for (let k = 0; k < 3; k++) {
    const y0 = 1.9 + k * 5.2;
    g.add(solid(new THREE.CylinderGeometry(5.2 - k * 0.5, 5.4 - k * 0.5, 4.6, 16).translate(0, y0 + 2.3, 0), k % 2 ? '#ffffff' : NAVY, { outlineWidth: 0.12 }));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(5.3 - k * 0.5, 5.3 - k * 0.5, 0.5, 16).translate(0, y0 + 4.85, 0), new THREE.MeshBasicMaterial({ color: '#00d4ff' })));
  }
  // Lanterne, galerie et toit.
  g.add(solid(new THREE.CylinderGeometry(4.6, 4.6, 0.5, 14).translate(0, 17.8, 0), '#26324a', { outlineWidth: 0.08 }));
  const lampMat = new THREE.MeshBasicMaterial({ color: '#bff4ff' });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 3.2, 12).translate(0, 19.6, 0), lampMat));
  g.add(solid(new THREE.ConeGeometry(3.4, 3, 12).translate(0, 22.7, 0), PALETTE.accent, { outlineWidth: 0.1 }));

  // Faisceau tournant.
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(7, 70, 16, 1, true).translate(0, -35, 0).rotateZ(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#e6fbff', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.position.y = 19.6;
  g.add(beam);
  anim.push((dt, t) => {
    beam.rotation.y = t * 0.6;
    lampMat.color.setHSL(0.53, 1, 0.82 + Math.sin(t * 3) * 0.08);
  });

  // Câbles de données sous l'eau vers les lieux reliés : des impulsions y circulent en continu.
  const pulseMat = new THREE.MeshBasicMaterial({ color: '#00d4ff', transparent: true, opacity: 0.9 });
  const lineMat = new THREE.MeshBasicMaterial({ color: '#00d4ff', transparent: true, opacity: 0.22, depthWrite: false });
  for (const l of links) {
    const ax = x, az = z, bx = l.x, bz = l.z;
    const len = Math.hypot(bx - ax, bz - az);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.8, len).rotateX(-Math.PI / 2), lineMat);
    line.position.set((ax + bx) / 2, 0.09, (az + bz) / 2);
    line.rotation.y = Math.atan2(bx - ax, bz - az);
    root.add(line);
    const pulses = [];
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(1.1, 8).rotateX(-Math.PI / 2), pulseMat);
      root.add(p);
      pulses.push(p);
    }
    anim.push((dt, t) => pulses.forEach((p, k) => {
      const u = (t * 18 / len + k / pulses.length) % 1;
      p.position.set(THREE.MathUtils.lerp(ax, bx, u), 0.12, THREE.MathUtils.lerp(az, bz, u));
    }));
  }

  labels.push({ pos: new THREE.Vector3(x, 26, z), html: '💡 Compétences · Phare des maîtrises', cls: 'label-place', zone: 'phare', hideInZone: true });
  zones.push({
    id: 'phare', x, z, r: 70, anchor: new THREE.Vector3(x, 26, z), cardSide: true, telemetry: true, look: { x: x - 12, z },
    card: {
      kicker: 'La donnée, le fil rouge', title: 'Le Phare des maîtrises',
      body: 'Tout ce que je construis repose sur une donnée bien maîtrisée. Ton bateau envoie sa télémétrie au phare : regarde-la arriver, se stocker et s’agréger en direct.',
      list: SKILLS.map((s) => ({ title: s.group, sub: s.items.join(' · ') })), accent: '#00d4ff', concepts: true,
    },
  });

  return { lamp: new THREE.Vector3(x, 19.6, z), beam };
}
