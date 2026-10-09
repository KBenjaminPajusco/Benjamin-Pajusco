import * as THREE from 'three';
import { solid, toon } from './toon.js?v=20261009103817';
import { person } from './characters.js?v=20261009103817';

// La boucle d'autofix, mise en scène dans l'open space des agents :
// un ticket passe de poste en poste, de la plainte de l'utilisateur jusqu'à ma décision.
export const STEPS = [
  { key: 'report', name: 'Bug report', hint: 'logs · navigateur · session · capture', who: 'user', icon: '🐞',
    text: 'Une issue arrive : « ça marche pas ». Sans contexte elle serait inexploitable, mais le bug report a tout capturé : logs, navigateur, session, capture d’écran.' },
  { key: 'issue', name: 'Issue GitHub', hint: 'le fil conducteur', who: 'kiosk', icon: 'assets/icons/github.svg',
    text: 'Tout part dans une issue GitHub : le fil conducteur. Chaque étape y sera postée, tout le travail se trace.' },
  { key: 'watch', name: 'Veille', hint: 'cron · toutes les 5 min', who: 'agent', icon: '⏱️',
    text: 'Toutes les 5 minutes, un agent de veille repère les nouvelles issues.' },
  { key: 'assess', name: 'Assess', hint: 'phase 1 · faisable ?', who: 'agent', icon: 'assets/icons/claude.svg',
    text: 'Phase 1 — Assess : un agent Claude juge si c’est faisable. Trivial ou petit : on y va.' },
  { key: 'fix', name: 'Fix', hint: 'phase 2 · édite le code', who: 'agent', icon: 'assets/icons/claude.svg',
    text: 'Phase 2 — Fix : l’agent corrige le code dans un espace de dev. Il ne touche jamais à git, jamais à la prod.' },
  { key: 'verify', name: 'Verify', hint: 'phase 3 · Playwright + capture', who: 'agent', icon: 'assets/icons/claude.svg',
    text: 'Phase 3 — Verify : test Playwright et capture d’écran pour prouver que c’est réglé.' },
  { key: 'teams', name: 'Teams', hint: 'autofix terminé', who: 'kiosk', icon: 'assets/icons/teams.svg',
    text: 'Notification Teams : l’autofix est terminé, le diff attend.' },
  { key: 'me', name: 'Moi', hint: 'je relis · je décide · je commit', who: 'me', icon: '🧑‍💻',
    text: 'Je relis le diff, je décide, je commit et je ferme l’issue. L’humain garde la décision finale.' },
];
const BRANCH_TEXT = 'Trop gros pour l’agent (feature, archi, refactor) : l’issue remonte directement vers moi.';

const NAVY = '#0a1422';
const CYAN = '#00d4ff';
const GREEN = '#2ecc71';
const RED = '#ef4444';
const ORANGE = '#f59e0b';

// Stations de l'open space, alignées en deux rangées : le ticket zigzague de bureau en bureau.
// Coordonnées dans le repère de construction du port (le port est déplacé d'un bloc ensuite).
// [x, z, orientation] — rangée nord (0 : assis au nord, face au sud), rangée sud (π : face au nord).
const LAYOUT_OS = [
  [353, -277, Math.PI / 2], [353, -291, 0], [366, -289, 0], [366, -279, Math.PI], [378, -289, 0], [378, -279, Math.PI], [389, -293, 0], [392, -283, -Math.PI / 2],
];

function desk(g, { wide = false } = {}) {
  const w = wide ? 6.4 : 4.4;
  g.add(solid(new THREE.BoxGeometry(w, 0.22, 2.4).translate(0, 1.9, 0), '#f2ede4', { outlineWidth: 0.05 }));
  for (const sx of [-1, 1]) g.add(solid(new THREE.BoxGeometry(0.16, 1.8, 2.1).translate(sx * (w / 2 - 0.2), 0.9, 0), '#9aa3ad', { outlineWidth: 0.03 }));
  // Chaise.
  g.add(solid(new THREE.BoxGeometry(1.5, 0.22, 1.4).translate(0, 1.25, -2.0), '#26324a', { outlineWidth: 0.04 }));
  g.add(solid(new THREE.BoxGeometry(1.5, 1.7, 0.22).translate(0, 2.2, -2.75), '#26324a', { outlineWidth: 0.04 }));
  g.add(solid(new THREE.CylinderGeometry(0.1, 0.1, 1.1, 5).translate(0, 0.6, -2.0), '#9aa3ad', { outlineWidth: 0 }));
}

// Portable ouvert : assez bas pour qu'on voie l'agent assis derrière, même depuis la caméra haute.
// Les écrans sont tournés vers la personne assise (côté -z), qui fait face à la caméra.
function laptop(g) {
  g.add(solid(new THREE.BoxGeometry(1.8, 0.1, 1.2).translate(0, 2.06, -0.1), '#55607a', { outlineWidth: 0.03 }));
  g.add(solid(new THREE.BoxGeometry(1.8, 1.1, 0.1).rotateX(0.25).translate(0, 2.6, 0.45), '#55607a', { outlineWidth: 0.03 }));
  const mat = new THREE.MeshBasicMaterial({ color: '#16304d' });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), mat);
  screen.position.set(0, 2.62, 0.38);
  screen.rotation.set(0.25, Math.PI, 0);
  g.add(screen);
  return mat;
}

function monitor(g, x = 0, w = 2.4) {
  g.add(solid(new THREE.BoxGeometry(0.18, 0.9, 0.18).translate(x, 2.45, -0.55), '#55607a', { outlineWidth: 0 }));
  g.add(solid(new THREE.BoxGeometry(w, 1.5, 0.16).translate(x, 3.3, -0.6), '#1d2533', { outlineWidth: 0.05 }));
  const mat = new THREE.MeshBasicMaterial({ color: '#16304d' });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.25, 1.25), mat);
  screen.position.set(x, 3.3, -0.69);
  screen.rotation.y = Math.PI;
  g.add(screen);
  return mat;
}

// Personnage assis derrière le bureau, face à la caméra.
function seated(g, opts, S) {
  const p = person(opts);
  p.scale.setScalar(S * 0.85);
  p.position.set(0, -0.62, -2.0);
  p.userData.legs.forEach((l) => { l.rotation.x = -1.45; });
  g.add(p);
  return p;
}

function plant(root, x, z, y) {
  root.add(solid(new THREE.CylinderGeometry(0.8, 0.6, 1.4, 7).translate(x, y + 0.7, z), '#c8553d', { outlineWidth: 0.05 }));
  root.add(solid(new THREE.IcosahedronGeometry(1.4, 0).scale(1, 1.4, 1).translate(x, y + 2.6, z), '#4f8f4a', { outlineWidth: 0.07 }));
}

export function buildCafe({ root, anim, labels, blocks, qTop, S }) {
  // Moquette de l'open space.
  const F = { x: 383, z: -284, w: 72, d: 26 };
  root.add(solid(new THREE.BoxGeometry(F.w, 0.12, F.d).translate(F.x, qTop + 0.06, F.z), '#e9e5dc', { outlineWidth: 0.08, cast: false }));
  // Murets de terrasse (avec une ouverture à l'ouest et au sud pour entrer).
  const wall = (x, z, w, d) => {
    root.add(solid(new THREE.BoxGeometry(w, 1.1, d).translate(x, qTop + 0.55, z), '#f4f1ea', { outlineWidth: 0.05 }));
    root.add(solid(new THREE.BoxGeometry(w, 0.25, d + 0.2).translate(x, qTop + 1.2, z), '#c9a66b', { outlineWidth: 0.03 }));
    blocks.boxes.push({ x, z, hx: w / 2 + 0.3, hz: d / 2 + 0.3 });
  };
  const x0 = F.x - F.w / 2, x1 = F.x + F.w / 2, z0 = F.z - F.d / 2, z1 = F.z + F.d / 2;
  wall(F.x, z0, F.w, 0.5);
  wall(x1, F.z, 0.5, F.d);
  wall((x0 + F.x - 8) / 2, z1, F.x - 8 - x0, 0.5);
  wall((F.x + 8 + x1) / 2, z1, x1 - F.x - 8, 0.5);
  wall(x0, z0 + 5, 0.5, 10);
  [[x0 + 2, z1 - 2], [x1 - 2, z0 + 2], [F.x - 10, z1 - 1.5], [F.x + 10, z1 - 1.5]].forEach(([x, z]) => {
    plant(root, x, z, qTop);
    blocks.circles.push({ x, z, r: 1.4 });
  });
  // Coin café : comptoir avec machine à café, tables rondes, tabourets, parasols.
  const cafe = new THREE.Group();
  cafe.position.set(0, qTop, 0);
  cafe.add(solid(new THREE.BoxGeometry(8, 2.2, 2.4).translate(410, 1.1, z0 + 2.2), '#5a3d2b', { outlineWidth: 0.05 }));
  cafe.add(solid(new THREE.BoxGeometry(8.4, 0.25, 2.8).translate(410, 2.3, z0 + 2.2), '#f6f1e7', { outlineWidth: 0.03 }));
  cafe.add(solid(new THREE.BoxGeometry(1.8, 2.2, 1.4).translate(408, 3.5, z0 + 2), '#1d2533', { outlineWidth: 0.04 }));
  cafe.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.05).translate(408, 4, z0 + 2.72), new THREE.MeshBasicMaterial({ color: '#ff6a4d' })));
  for (const dx of [-1.2, 1.4, 2.6]) cafe.add(solid(new THREE.CylinderGeometry(0.22, 0.18, 0.4, 8).translate(410 + dx, 2.62, z0 + 2.4), '#ffffff', { outlineWidth: 0 }));
  blocks.boxes.push({ x: 410, z: z0 + 2.2, hx: 4.5, hz: 1.6 });
  const parasolCols = ['#ff6a4d', '#3ec7c2'];
  [[404, z1 - 6], [414, z1 - 9]].forEach(([tx, tz], k) => {
    cafe.add(solid(new THREE.CylinderGeometry(1.6, 1.6, 0.15, 12).translate(tx, 1.9, tz), '#ffffff', { outlineWidth: 0.04 }));
    cafe.add(solid(new THREE.CylinderGeometry(0.15, 0.25, 1.9, 6).translate(tx, 0.95, tz), '#9aa3ad', { outlineWidth: 0 }));
    for (let s = 0; s < 3; s++) {
      const a = (s / 3) * Math.PI * 2 + k;
      cafe.add(solid(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 8).translate(tx + Math.cos(a) * 2.4, 0.6, tz + Math.sin(a) * 2.4), '#c9a66b', { outlineWidth: 0.03 }));
    }
    cafe.add(solid(new THREE.CylinderGeometry(0.07, 0.07, 5, 4).translate(tx, 2.5, tz), '#ffffff', { outlineWidth: 0 }));
    cafe.add(solid(new THREE.ConeGeometry(3.4, 1.2, 8).translate(tx, 5.4, tz), parasolCols[k], { outlineWidth: 0.05 }));
    blocks.circles.push({ x: tx, z: tz, r: 3.2 });
  });
  // Quelqu'un en pause café, au comptoir.
  const coffee = person({ shirt: '#ffc845' });
  coffee.scale.setScalar(S * 0.85);
  coffee.position.set(411, 0, z0 + 4.8);
  coffee.rotation.y = Math.PI;
  coffee.userData.arms[0].rotation.x = -1.6;
  cafe.add(coffee);
  root.add(cafe);

  const stations = STEPS.map((step, i) => {
    const [x, z, rot] = LAYOUT_OS[i];
    const g = new THREE.Group();
    g.position.set(x, qTop, z);
    g.scale.setScalar(1.3);
    const ud = { busy: false, screens: [], label: null };

    if (step.key === 'issue') {
      // L'imprimante : c'est elle qui « imprime » l'issue GitHub.
      g.add(solid(new THREE.BoxGeometry(3.4, 1.6, 2.6).translate(0, 0.8, 0), '#cfd6e0', { outlineWidth: 0.05 }));
      g.add(solid(new THREE.BoxGeometry(3.0, 1.3, 2.2).translate(0, 2.25, 0), '#eef1f4', { outlineWidth: 0.06 }));
      g.add(solid(new THREE.BoxGeometry(3.0, 0.3, 1.1).translate(0, 2.95, -0.5), '#3c4a5c', { outlineWidth: 0.04 }));
      g.add(solid(new THREE.BoxGeometry(2.2, 0.12, 1.2).translate(0, 1.75, 1.6), '#9aa3ad', { outlineWidth: 0.03 }));
      const led = new THREE.MeshBasicMaterial({ color: '#16304d' });
      const ledMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.05), led);
      ledMesh.position.set(1, 2.5, 1.12);
      g.add(ledMesh);
      ud.screens.push(led);
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      paper.position.set(0, 2.0, 1.2);
      paper.userData.dynamic = true; // bouge pendant l'impression : jamais fusionné
      g.add(paper);
      ud.paper = paper;
      blocks.boxes.push({ x, z, hx: 2.4, hz: 2 });
    } else if (step.key === 'teams') {
      // Grand écran sur pied : la notification Teams.
      g.add(solid(new THREE.BoxGeometry(2.6, 0.2, 1.6).translate(0, 0.1, 0), '#3c4a5c', { outlineWidth: 0.04 }));
      g.add(solid(new THREE.BoxGeometry(0.25, 4, 0.25).translate(0, 2.1, 0), '#55607a', { outlineWidth: 0.03 }));
      g.add(solid(new THREE.BoxGeometry(5, 3, 0.25).translate(0, 5, 0), '#1d2533', { outlineWidth: 0.06 }));
      const mat = new THREE.MeshBasicMaterial({ color: '#16304d' });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.6), mat);
      screen.position.set(0, 5, 0.14);
      g.add(screen);
      ud.screens.push(mat);
      ud.activeColor = '#5b5fc7';
      blocks.boxes.push({ x, z, hx: 3.4, hz: 1.4 });
    } else {
      const island = step.who === 'agent';
      const me = step.key === 'me';
      desk(g, { wide: me });
      if (me) { ud.screens.push(monitor(g, -1.4, 2.2), monitor(g, 1.4, 2.2)); }
      else if (step.key === 'report') {
        // Le collègue qui râle : un portable et un point d'exclamation rouge.
        ud.screens.push(laptop(g));
        ud.activeColor = RED;
      } else ud.screens.push(island ? laptop(g) : monitor(g));
      const who = me ? seated(g, { shirt: '#ff6a4d', pants: '#26324a' }, S)
        : step.key === 'report' ? seated(g, { shirt: '#9aa3ad' }, S)
        : seated(g, { shirt: ['#3ec7c2', '#4d7cff', '#a25dd9', '#2f9e55'][i % 4], agent: true }, S);
      const ph = i * 0.9;
      anim.push((dt, t) => {
        who.userData.arms.forEach((arm, k) => {
          arm.rotation.x = ud.busy ? -1.25 + Math.sin(t * 14 + k * 2) * 0.18 : -1.1 + Math.sin(t * 1.5 + ph) * 0.04;
        });
        who.rotation.y = ud.busy ? Math.sin(t * 2) * 0.08 : 0;
      });
      // Orientation du poste : îlot en vis-à-vis pour les agents, de profil pour le collègue, en bout d'îlot pour moi.
      g.rotation.y = rot;
      // Lampe d'activité sur le bureau, bien visible du dessus.
      const lampMat = new THREE.MeshBasicMaterial({ color: '#16304d' });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 6), lampMat);
      lamp.position.set(me ? 2.6 : 1.6, 2.4, 0.6);
      g.add(lamp);
      ud.screens.push(lampMat);
      // Emprise du poste (bureau + chaise), selon l'orientation.
      const bx = x - Math.sin(rot) * 1.6, bz = z - Math.cos(rot) * 1.6;
      const along = Math.abs(Math.sin(rot)) > 0.5;
      blocks.boxes.push({ x: bx, z: bz, hx: along ? 3.6 : (me ? 4.4 : 3.2), hz: along ? (me ? 4.4 : 3.2) : 3.6 });
    }

    root.add(g);

    // L'icône vit dans l'étiquette (une seule bulle par poste, juste au-dessus des têtes).
    const ico = step.icon.endsWith('.svg') ? `<img src="${step.icon}" alt="">` : `<span class="emo">${step.icon}</span>`;
    const label = { pos: new THREE.Vector3(x, qTop + (step.key === 'teams' ? 9.5 : 7), z), html: `<i>${i + 1}</i>${ico}<b>${step.name}</b>`, cls: 'label-step', zone: 'agents' };
    labels.push(label);
    ud.label = label;
    g.userData = ud;
    return g;
  });

  // Chemin au sol : un trait par étape, et le raccourci orange « trop gros » de Assess vers moi.
  const pathMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.85 });
  const branchMat = new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0 });
  const dashes = (a, b, mat, z0 = 0) => {
    const ax = a.position.x, az = a.position.z + z0, bx = b.position.x, bz = b.position.z + z0;
    const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 1.6);
    for (let k = 1; k < n; k += 2) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 1.0).rotateX(-Math.PI / 2), mat);
      m.position.set(THREE.MathUtils.lerp(ax, bx, k / n), qTop + 0.14, THREE.MathUtils.lerp(az, bz, k / n));
      m.rotation.y = Math.atan2(bx - ax, bz - az);
      root.add(m);
    }
  };
  for (let i = 0; i < stations.length - 1; i++) dashes(stations[i], stations[i + 1], pathMat);
  dashes(stations[3], stations[7], branchMat);

  // Le ticket : une feuille lumineuse qui vole de poste en poste.
  const ticketMat = new THREE.MeshBasicMaterial({ color: RED });
  const ticket = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.2), ticketMat);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(1.4, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.35, depthWrite: false }));
  root.add(ticket, halo);

  const state = { step: 0, cycle: 0, branch: false, text: STEPS[0].text, changed: true };
  const DWELL = 2.4, HOP = 1.0;
  let t0 = 0, ri = 0;
  const route = () => (state.branch ? [0, 1, 2, 3, 7] : [0, 1, 2, 3, 4, 5, 6, 7]);

  function setStep(i) {
    state.step = i;
    state.text = state.branch && i === 7 ? BRANCH_TEXT : STEPS[i].text;
    state.changed = true;
    stations.forEach((s, k) => {
      const ud = s.userData;
      ud.busy = k === i;
      ud.screens.forEach((m) => m.color.set(k === i ? (ud.activeColor || CYAN) : '#16304d'));
      ud.label.active = k === i;
    });
    const done = i >= 5;
    ticketMat.color.set(i === 0 ? RED : state.branch && i === 7 ? ORANGE : done ? GREEN : CYAN);
    branchMat.opacity = state.branch ? 0.95 : 0;
  }
  setStep(0);

  anim.push((dt, t) => {
    const r = route();
    const local = t - t0;
    const from = stations[r[ri]], to = stations[r[(ri + 1) % r.length]];
    let k = local > DWELL ? Math.min((local - DWELL) / HOP, 1) : 0;
    const ease = k * k * (3 - 2 * k);
    // Pendant l'attente, le ticket flotte au-dessus du poste ; à l'imprimante il sort du bac.
    const printing = r[ri] === 1 && k === 0;
    const pa = from.position, pb = to.position;
    ticket.position.set(
      THREE.MathUtils.lerp(pa.x, pb.x, ease),
      qTop + (printing ? 2.2 + Math.min(local / DWELL, 1) * 2.8 : 5 + Math.sin(ease * Math.PI) * 3.5 + Math.sin(t * 3) * 0.15),
      THREE.MathUtils.lerp(pa.z, pb.z, ease) + (printing ? 1.6 : 0),
    );
    ticket.rotation.y = printing ? 0 : t * 1.5;
    const paper = stations[1].userData.paper;
    paper.position.z = 1.2 + (printing ? Math.min(local / DWELL, 1) * 0.8 : 0);
    halo.position.set(ticket.position.x, qTop + 0.16, ticket.position.z);
    halo.scale.setScalar(1 + Math.sin(t * 4) * 0.15);
    if (k >= 1) {
      t0 = t;
      ri = (ri + 1) % r.length;
      if (ri === 0) { state.cycle++; state.branch = state.cycle % 3 === 2; }
      setStep(route()[ri]);
    }
  });

  return { state, stations };
}

// L'équipe d'agents que je dirige (écran « L'ingénieur augmenté »).
export const TEAM = [
  { file: 'veille-github.md', name: 'Veille GitHub', when: 'cron · 5 min', job: 'Lit les nouvelles issues et les qualifie : trivial, petit, ou pour moi.' },
  { file: 'architecte.md', name: 'Architecte', when: 'avant de coder', job: 'Explore le code, rédige un plan, découpe et le fait valider.' },
  { file: 'developpeur.md', name: 'Développeur', when: 'issue assignée', job: 'Code la feature ou le fix, tests compris, et me montre le diff.' },
  { file: 'deploiement.md', name: 'Déploiement', when: 'mise en prod', job: 'Build, tests de bout en bout, bascule du serveur web.' },
  { file: 'health-reporter.md', name: 'Health reporter', when: 'chaque heure · digest 08:00', job: 'Agrège logs, disque et sources, poste le rapport de santé.' },
  { file: 'sysadmin.md', name: 'Sysadmin', when: 'nouvelle machine', job: 'Configure une machine de A à Z : runtimes, services, droits.' },
  { file: 'reseau.md', name: 'Réseau', when: 'incident VPN · accès', job: 'Diagnostique tunnels et connexions, remonte la cause, propose le fix.' },
  { file: 'base-de-donnees.md', name: 'Base de données', when: 'lecture seule', job: 'Inspecte structures et erreurs dans les bases.' },
  { file: 'operateur-ssh.md', name: 'Opérateur SSH', when: 'serveurs du lab', job: 'Se connecte, exécute, vérifie, et rend compte de chaque commande.' },
];
