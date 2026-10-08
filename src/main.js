import * as THREE from 'three';
import { Boat } from './boat.js';
import { buildWorld, LAYOUT } from './world.js';
import { Wake, FoilSpray, WindStreaks } from './effects.js';
import { Walker } from './walker.js';
import { Rib } from './rib.js';
import { applyDayNight, currentHour } from './daynight.js';
import { STEPS, TEAM } from './cafe.js';
import { renderGeoMap, renderRegattaMap } from './geomap.js';
import { DataStream, Recorder, TelemetryPanel } from './telemetry.js';
import { PROFILE, EXPERIENCES, EDUCATION, INTERESTS, CONCEPTS, WORKS, REGATTAS, SKILLS } from './cv.js';
import { Race, COURSE } from './race.js';
import { StaticMerger } from './optimize.js';

const $ = (s) => document.querySelector(s);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// --- Rendu
const canvas = $('#scene');
// Téléphone (portrait, ou paysage avec écran tactile) : rendu allégé et interface compacte.
const MOBILE_MQ = matchMedia('(max-width: 640px), (pointer: coarse) and (max-width: 950px)');
const IS_MOBILE = MOBILE_MQ.matches;
// Anticrénelage partout : sur téléphone la résolution adaptative compense si les images ralentissent.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_MOBILE ? 1.5 : 2)); // un peu plus léger sur téléphone
renderer.shadowMap.enabled = !IS_MOBILE; // pas d'ombres portées sur téléphone
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#2c7fb8');
const camera = new THREE.PerspectiveCamera(30, 1, 5, 9000);

const hemi = new THREE.HemisphereLight('#ffffff', '#7fb8d8', 1.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff4e0', 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 500 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

const world = buildWorld(scene);
// Régate en flotte à l'ouest : son plan d'eau, sa zone et son étiquette.
const race = new Race(scene, world);
{
  const { line } = COURSE;
  const cx = (line.x0 + line.x1) / 2;
  world.zones.push({
    id: 'regate', x: cx, z: line.z + 18, r: 46, zoom: 1.4, anchor: new THREE.Vector3(line.x1, 10, line.z),
    card: {
      kicker: 'Régate en flotte', title: 'Prends le départ !', accent: '#ffc845', raceBtn: true,
      body: 'Contre 2 foilers. Passe la ligne (entre la bouée viseur et le comité) vers le nord après le signal, enroule la bouée jaune au nord en la laissant à bâbord, reviens finir sur la ligne. Règles : 10, bâbord amure s’écarte de tribord amure ; 11, au vent s’écarte de sous le vent ; 12, celui qui est derrière s’écarte de celui devant ; 31, ne touche ni les bouées ni le comité. Au-dessus de la ligne au signal : OCS, il faut repasser la ligne.',
      tags: ['Départ 30 s après inscription', 'Règles de base'],
    },
  });
  world.labels.push({ pos: new THREE.Vector3(line.x1, 12, line.z), html: '🏁 Régate', cls: 'label-place', zone: 'regate', hideInZone: true });
}
let boat = new Boat(); // remplacé par un semi-rigide si le visiteur ne navigue pas
boat.pos.set(LAYOUT.start.x, LAYOUT.start.z);
scene.add(boat.root);
const wake = new Wake();
scene.add(wake.points);
const spray = new FoilSpray(IS_MOBILE ? 700 : 1400);
scene.add(spray.points);
const streaks = new WindStreaks();
scene.add(streaks.group);
const walker = new Walker();
scene.add(walker.root);
const stream = new DataStream();
scene.add(stream.mesh);
const recorder = new Recorder();
// Fusion du décor immobile après quelques secondes (gros gain de fluidité, surtout sur téléphone).
const merger = new StaticMerger(scene, { exclude: [walker.root, stream.mesh, wake.points, spray.points] });
const telemetry = new TelemetryPanel($('#telemetry'), recorder);
const mastTop = new THREE.Vector3();
let mode = 'boat'; // 'boat' | 'walk'

// --- Commandes : clavier (relatif au bateau) ou pointeur maintenu (aller vers un point).
const keys = new Set();
let started = false;
let touched = false;
addEventListener('keydown', (e) => {
  if ($('#cv').hidden === false) { if (e.key === 'Escape') closeCv(); return; }
  if ($('#map').hidden === false) { if (e.key === 'Escape') closeMap(); return; }
  if ($('#team').hidden === false) { if (e.key === 'Escape') closeTeam(); return; }
  if ($('#savoirs').hidden === false) { if (e.key === 'Escape') $('#savoirs').hidden = true; return; }
  if (e.key.toLowerCase() === 'm' && started) { openMap(); return; }
  if (e.key.toLowerCase() === 'e' && started) { doAction(); return; }
  if (!started) start();
  keys.add(e.key.toLowerCase());
  if (e.key.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

const pointer = { active: false, ndc: new THREE.Vector2() };
canvas.addEventListener('pointerdown', (e) => {
  if (!started) start();
  pointer.active = true;
  setPointer(e);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => pointer.active && setPointer(e));
// Glisser sur la scène ne doit jamais sélectionner le texte des étiquettes ou des fiches.
canvas.addEventListener('mousedown', (e) => e.preventDefault());
document.addEventListener('selectstart', (e) => { if (pointer.active) e.preventDefault(); });
canvas.addEventListener('pointerup', () => { pointer.active = false; });
canvas.addEventListener('pointercancel', () => { pointer.active = false; });
function setPointer(e) {
  pointer.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
}

let userZoom = 1.2; // un peu plus large par défaut
canvas.addEventListener('wheel', (e) => {
  userZoom = THREE.MathUtils.clamp(userZoom * Math.exp(e.deltaY * 0.001), 0.2, 14); // dézoom large : vue d'ensemble du plan d'eau
  e.preventDefault();
}, { passive: false });

const raycaster = new THREE.Raycaster();
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();

function readInput() {
  const k = (...names) => names.some((n) => keys.has(n));
  const input = { steer: 0, power: 0, brake: false };
  if (k('arrowleft', 'a', 'q')) input.steer += 1;
  if (k('arrowright', 'd')) input.steer -= 1;
  if (k('arrowup', 'w', 'z')) input.power = 1;
  if (k('arrowdown', 's')) input.brake = true;
  if (pointer.active) {
    raycaster.setFromCamera(pointer.ndc, camera);
    if (raycaster.ray.intersectPlane(waterPlane, hitPoint)) {
      const dx = hitPoint.x - boat.pos.x, dz = hitPoint.z - boat.pos.y;
      const err = wrap(Math.atan2(dx, dz) - boat.heading);
      input.steer = THREE.MathUtils.clamp(err * 1.8, -1, 1);
      input.power = Math.hypot(dx, dz) > 12 ? 1 : 0.3;
    }
  }
  if (!started) { input.steer = 0; input.power = 0; }
  input.any = input.steer !== 0 || input.power > 0 || input.brake;
  if (!touched && (input.steer || input.power === 1)) {
    touched = true;
    setTimeout(() => $('#hint').classList.add('gone'), 2500);
  }
  return input;
}

// À pied, les directions sont celles de l'écran (haut = nord) : plus naturel en vue de dessus.
function readWalkInput() {
  const k = (...names) => names.some((n) => keys.has(n));
  const v = { x: 0, z: 0, run: keys.has('shift') };
  if (k('arrowleft', 'a', 'q')) v.x -= 1;
  if (k('arrowright', 'd')) v.x += 1;
  if (k('arrowup', 'w', 'z')) v.z -= 1;
  if (k('arrowdown', 's')) v.z += 1;
  if (pointer.active) {
    raycaster.setFromCamera(pointer.ndc, camera);
    if (raycaster.ray.intersectPlane(waterPlane, hitPoint)) {
      const dx = hitPoint.x - walker.pos.x, dz = hitPoint.z - walker.pos.y, d = Math.hypot(dx, dz);
      if (d > 2) { v.x = dx / d; v.z = dz / d; }
    }
  }
  return v;
}

// --- Débarquer / rembarquer.
const actionBtn = $('#action');
let landing = null;
let actionCheck = 0;
function updateAction(dt) {
  actionCheck -= dt;
  if (mode === 'boat') {
    if (actionCheck <= 0) {
      actionCheck = 0.2;
      // Dans le port, on peut débarquer de n'importe où dans le bassin, même lancé : on est posé sur le quai le plus proche.
      const inPort = world.inPort(boat.pos);
      landing = started && (inPort || boat.speed < 5) ? world.landingSpot(boat.pos.x, boat.pos.y, inPort ? 140 : 24) : null;
    }
    setAction(landing ? 'Débarquer' : null);
  } else {
    const near = Math.hypot(walker.pos.x - boat.pos.x, walker.pos.y - boat.pos.y) < 28;
    // Sur l'île, bateau amarré au port : on peut toujours y retourner d'un geste.
    setAction(near ? 'Rembarquer' : world.inPort(boat.pos) && world.inPort(walker.pos) ? 'Retour au bateau' : null);
  }
}
function setAction(label) {
  actionBtn.hidden = !label;
  if (label) actionBtn.innerHTML = `${label} <kbd>E</kbd>`;
}
function disembark(spot) {
  mode = 'walk';
  walker.place(spot.x, spot.y, world);
  walker.heading = Math.atan2(spot.x - boat.pos.x, spot.y - boat.pos.y);
  walker.root.visible = true;
  boat.speed = 0;
  $('#hint').textContent = 'Flèches pour marcher · Maj pour courir · ou garde le clic enfoncé · E pour rembarquer près du bateau';
  $('#hint').classList.remove('gone');
  setTimeout(() => $('#hint').classList.add('gone'), 4000);
}
function doAction() {
  if (mode === 'boat' && landing) disembark(landing);
  else if (mode === 'walk' && !actionBtn.hidden) {
    mode = 'boat';
    walker.root.visible = false;
  }
}
actionBtn.addEventListener('click', doAction);

// --- Étiquettes HTML accrochées au monde.
const labelLayer = $('#labels');
const labels = world.labels.map((l) => {
  const el = document.createElement('div');
  el.className = `label ${l.cls}`;
  el.innerHTML = l.html;
  el.style.left = el.style.top = '0';
  labelLayer.appendChild(el);
  return { ...l, el, src: l };
});
const proj = new THREE.Vector3();
const toScreen = (v) => {
  proj.copy(v).project(camera);
  return { x: ((proj.x + 1) / 2) * innerWidth, y: ((1 - proj.y) / 2) * innerHeight };
};
function updateLabels(focus) {
  const zoneId = activeZone?.id;
  const overworld = ow > 0.5;
  for (const l of labels) {
    // Carte du monde : seuls les grands noms de régions ; sinon, tous les détails sauf ces noms.
    if (!!l.overworld !== overworld) { if (l.op !== 0) { l.op = 0; l.el.style.opacity = 0; } continue; }
    // zone : visible seulement dans cette zone ; hideInZone : masquée quand la grande fiche la remplace.
    const gated = l.zone && (l.hideInZone ? zoneId === l.zone : zoneId !== l.zone);
    proj.copy(l.pos).project(camera);
    const dist = Math.hypot(l.pos.x - focus.x, l.pos.z - focus.z);
    // Plus on dézoome, plus on garde d'étiquettes visibles.
    const reach = overworld ? 1e5 : 260 * Math.max(1, userZoom);
    const visible = !gated && proj.z < 1 && Math.abs(proj.x) < 1.15 && Math.abs(proj.y) < 1.15 && dist < reach;
    // Écritures DOM seulement quand la valeur change (gros gain sur téléphone).
    const op = visible ? Math.round(Math.min(1, (reach - dist) / 60) * 20) / 20 : 0;
    if (op !== l.op) { l.op = op; l.el.style.opacity = op; }
    const act = !!l.src.active;
    if (act !== l.act) { l.act = act; l.el.classList.toggle('active', act); }
    if (visible) {
      const x = Math.round(((proj.x + 1) / 2) * innerWidth), y = Math.round(((1 - proj.y) / 2) * innerHeight);
      if (x !== l.x || y !== l.y) { l.x = x; l.y = y; l.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; }
    }
  }
}

// --- Fiche de la zone active, accrochée au-dessus de ce qu'elle décrit.
const card = $('#card');
let activeZone = null;
// Téléphone : la fiche fermée à la croix le reste tant qu'on ne quitte pas la zone (petit onglet pour la rouvrir).
let dismissed = null;
const cardTab = $('#card-tab');
function closeCard() {
  if (!activeZone) return;
  dismissed = activeZone;
  card.hidden = true;
  stamp.hidden = true;
}
card.querySelector('.card-close').addEventListener('click', closeCard);
// Fiche d'arrivée : l'action principale est de mettre pied à terre, au quai le plus proche.
card.querySelector('.land-btn').addEventListener('click', () => {
  if (mode !== 'boat') return;
  const spot = landing || world.landingSpot(boat.pos.x, boat.pos.y, 140);
  if (spot) { disembark(spot); card.querySelector('.land-btn').hidden = true; }
});
cardTab.addEventListener('click', () => {
  dismissed = null;
  activeZone = null; // la prochaine mise à jour rouvre la fiche (et la carte) de la zone
  cardTab.hidden = true;
});
let cardSize = { w: 0, h: 0 };

// --- Course à pied : le footing du visiteur sur l'île, présenté comme un rapport d'activité (carte, distance, allure).
// 1 unité = 1 m ; le temps de jeu est accéléré pour des allures crédibles (≈ 4:10 /km en courant, ≈ 7:50 /km en marchant).
const RUN_TIME_SCALE = 7.5;
const runLog = { segs: [], dist: 0, time: 0, start: null, prev: null };
function recordRun(dt) {
  // Le chrono ne tourne que si l'on avance vraiment (pas quand on bute contre un mur), comme une pause auto.
  const prev = runLog.prev ?? walker.pos.clone();
  const moved = Math.hypot(walker.pos.x - prev.x, walker.pos.y - prev.y);
  runLog.prev = walker.pos.clone();
  if (walker.pull || moved > 20 || moved / Math.max(dt, 1e-3) < 1 || !world.inPort(walker.pos)) return;
  runLog.time += dt * RUN_TIME_SCALE;
  runLog.start ??= new Date();
  let seg = runLog.segs[runLog.segs.length - 1];
  const last = seg?.[seg.length - 1];
  const d = last ? Math.hypot(walker.pos.x - last.x, walker.pos.y - last.z) : 0;
  if (!last || d > 40) { seg = []; runLog.segs.push(seg); } // téléportation ou retour à terre : nouveau tronçon
  else if (d < 2.5) return;
  else runLog.dist += d;
  seg.push({ x: walker.pos.x, z: walker.pos.y });
}
const fmtDur = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`; };
let actAge = 1e9;
function renderActivity(dt) {
  actAge += dt;
  if (actAge < 0.3) return;
  actAge = 0;
  const el = card.querySelector('.activity');
  const km = runLog.dist / 1000;
  el.querySelector('.act-dist').textContent = `${km.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;
  el.querySelector('.act-pace').textContent = km > 0.02 ? `${fmtDur(runLog.time / km)} /km` : '–:–– /km';
  el.querySelector('.act-time').textContent = fmtDur(runLog.time);
  el.querySelector('.act-when').textContent = runLog.start
    ? `Aujourd’hui à ${runLog.start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · Île de Benjamin`
    : 'Pas encore parti';
  el.querySelector('.act-empty').hidden = runLog.dist > 5;
  drawActivityMap(el.querySelector('.act-map'));
}
function drawActivityMap(cv) {
  const poly = world.islandPoly();
  if (!poly) return;
  const dpr = Math.min(devicePixelRatio, 2), W = cv.clientWidth || 320, H = cv.clientHeight || 180;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Cadrage sur la trace (au moins 160 m de large), sinon toute l'île.
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  const grow = (x, z) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); };
  const trace = runLog.segs.flat();
  if (runLog.dist > 5) {
    trace.forEach((p) => grow(p.x, p.z));
    if (mode === 'walk') grow(walker.pos.x, walker.pos.y);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hw = Math.max((x1 - x0) / 2, 80), hh = Math.max((z1 - z0) / 2, 45);
    x0 = cx - hw; x1 = cx + hw; z0 = cz - hh; z1 = cz + hh;
  } else poly.forEach((p) => grow(p.x, p.y));
  const pad = 14, s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (z1 - z0));
  const X = (x) => W / 2 + (x - (x0 + x1) / 2) * s, Y = (z) => H / 2 + (z - (z0 + z1) / 2) * s;
  ctx.fillStyle = '#d6e6ef'; ctx.fillRect(0, 0, W, H);
  ctx.beginPath(); poly.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(p.x), Y(p.y))); ctx.closePath();
  ctx.fillStyle = '#f4f1ea'; ctx.fill(); ctx.strokeStyle = '#b9c7cf'; ctx.lineWidth = 1; ctx.stroke();
  // Les rues, en traits fins comme sur une carte de sortie.
  ctx.lineJoin = ctx.lineCap = 'round';
  ctx.strokeStyle = '#d3cbb9'; ctx.lineWidth = Math.max(2.4, 7.2 * s);
  for (const r of world.map.roads) { ctx.beginPath(); r.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(p.x), Y(p.z))); ctx.stroke(); }
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.2, 5 * s);
  for (const r of world.map.roads) { ctx.beginPath(); r.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(p.x), Y(p.z))); ctx.stroke(); }
  // La trace : orange vif, départ en vert, position actuelle en point plein.
  ctx.strokeStyle = '#fc5200'; ctx.lineWidth = 3;
  for (const seg of runLog.segs) {
    if (seg.length < 2) continue;
    ctx.beginPath(); seg.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(p.x), Y(p.z))); ctx.stroke();
  }
  const first = runLog.segs.find((g) => g.length)?.[0];
  if (first) { ctx.fillStyle = '#2f9e55'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(first.x), Y(first.z), 4.5, 0, 7); ctx.fill(); ctx.stroke(); }
  if (mode === 'walk') { ctx.fillStyle = '#1d2533'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(walker.pos.x), Y(walker.pos.y), 4.5, 0, 7); ctx.fill(); ctx.stroke(); }
}

// --- Tractions : chaque traction faite par un visiteur s'ajoute à un compteur partagé (service Abacus, sans compte).
const PULLUP_API = 'https://abacus.jasoncameron.dev';
const PULLUP_KEY = 'benjamin-pajusco-fr/tractions';
let pullTotal = null, pullMine = 0, pullFetchedAt = -1e9;
try { pullMine = +localStorage.getItem('tractions') || 0; } catch { /* stockage indisponible */ }
function renderPullups() {
  const el = card.querySelector('.pullup-count');
  if (pullTotal === null) { el.textContent = pullMine ? `Toi : ${pullMine} traction${pullMine > 1 ? 's' : ''}` : ''; return; }
  el.innerHTML = `<b>${pullTotal.toLocaleString('fr-FR')}</b> traction${pullTotal > 1 ? 's' : ''} faite${pullTotal > 1 ? 's' : ''} par les visiteurs du site`
    + (pullMine ? `<span>dont ${pullMine} par toi</span>` : '');
}
function refreshPullups() {
  renderPullups();
  if (performance.now() - pullFetchedAt < 15000) return;
  pullFetchedAt = performance.now();
  fetch(`${PULLUP_API}/get/${PULLUP_KEY}`).then((r) => r.json()).then((d) => {
    if (typeof d.value === 'number') { pullTotal = Math.max(pullTotal ?? 0, d.value); renderPullups(); }
  }).catch(() => {});
}
function countPullups(n) {
  pullMine += n;
  try { localStorage.setItem('tractions', pullMine); } catch { /* stockage indisponible */ }
  if (pullTotal !== null) pullTotal += n; // affichage immédiat, recalé par la réponse du serveur
  renderPullups();
  for (let i = 0; i < n; i++) {
    fetch(`${PULLUP_API}/hit/${PULLUP_KEY}`).then((r) => r.json()).then((d) => {
      if (typeof d.value === 'number') { pullTotal = Math.max(pullTotal ?? 0, d.value); renderPullups(); }
    }).catch(() => {});
  }
}
card.querySelector('.pullup-btn').addEventListener('click', () => {
  if (mode !== 'walk') return;
  const z = world.zones.find((q) => q.id === 'gym');
  walker.startPull({ x: z.x + z.bar.dx, z: z.z + z.bar.dz, y: z.bar.y });
});

function renderCard(z) {
  const c = z.card;
  card.style.setProperty('--card-accent', c.accent || '#ff6a4d');
  const logo = card.querySelector('.logo');
  logo.hidden = !c.brand;
  if (c.brand) {
    logo.style.background = c.brand.color;
    logo.style.color = c.brand.ink || '#fff';
    logo.textContent = c.brand.mono;
    if (c.logo) {
      const img = new Image();
      img.alt = c.title;
      img.onload = () => { logo.textContent = ''; logo.style.background = '#fff'; logo.classList.toggle('round', !!c.brand.round); logo.appendChild(img); };
      img.src = c.logo;
    }
  }
  card.querySelector('.kicker').textContent = c.kicker || '';
  card.querySelector('h2').textContent = c.title;
  const sub = card.querySelector('.sub');
  sub.textContent = c.sub || '';
  sub.hidden = !c.sub;
  const tags = card.querySelector('.tags');
  tags.innerHTML = '';
  (c.tags || []).forEach((t) => { const el = document.createElement('span'); el.textContent = t; tags.appendChild(el); });
  const body = card.querySelector('.body');
  body.textContent = c.body || '';
  body.hidden = !c.body;
  const list = card.querySelector('.list');
  list.innerHTML = '';
  (c.list || []).forEach((it) => {
    const li = document.createElement('li');
    li.innerHTML = `<b></b><span></span>${it.body ? '<p></p>' : ''}`;
    li.querySelector('b').textContent = it.title;
    li.querySelector('span').textContent = it.sub;
    if (it.body) li.querySelector('p').textContent = it.body;
    list.appendChild(li);
  });
  const live = card.querySelector('.live');
  live.hidden = !z.live;
  if (z.live) renderLive(true);
  const extra = card.querySelector('.extra');
  extra.hidden = z.id !== 'agents';
  card.querySelector('.concepts-btn').hidden = !c.concepts;
  card.querySelector('.race-btn').hidden = !c.raceBtn;
  card.querySelector('.pullup').hidden = z.id !== 'gym';
  card.querySelector('.activity').hidden = z.id !== 'run';
  if (z.id === 'run') { actAge = 1e9; renderActivity(0); }
  if (z.id === 'gym') refreshPullups();
  const meta = card.querySelector('.meta');
  meta.textContent = c.meta || '';
  meta.hidden = !c.meta;
  card.querySelector('[data-open-cv]').hidden = !c.cta;
  card.querySelector('.land-btn').hidden = !c.land || mode === 'walk';
  card.hidden = false;
  card.classList.remove('pop');
  void card.offsetWidth;
  card.classList.add('pop');
  cardSize = { w: card.offsetWidth, h: card.offsetHeight };
}
function updateZones() {
  // En bateau on regarde les zones sur l'eau ; à pied, leur version à terre (land).
  const me = mode === 'walk' ? walker.pos : boat.pos;
  let best = null, bestScore = 1;
  for (const z of world.zones) {
    const area = mode === 'walk' ? z.land : z;
    if (!area) continue;
    if (z.id === 'regate' && race.playerIn) continue; // inscrit : la fiche laisse place au plan d'eau et au chrono
    const s = Math.hypot(me.x - area.x, me.y - area.z) / area.r;
    if (s < bestScore) { bestScore = s; best = z; }
  }
  if (best !== dismissed) dismissed = null; // zone quittée : la prochaine fiche s'ouvre de nouveau
  cardTab.hidden = !(dismissed && docked());
  if (best !== activeZone) {
    activeZone = best;
    if (best && best === dismissed) { card.hidden = true; stamp.hidden = true; return; }
    if (best) renderCard(best); else card.hidden = true;
    // La carte reste affichée tant qu'on est dans la zone du lieu.
    if (best?.id === 'shn') showRegattas();
    else if (best?.geo) showStamp(best.geo);
    else stamp.hidden = true;
  }
}
// Narration en direct de la boucle d'autofix, synchronisée avec le ticket qui circule.
function renderLive(force = false) {
  const st = world.cafe.state;
  if (!force && !st.changed) return;
  st.changed = false;
  const live = card.querySelector('.live');
  live.querySelector('.step').textContent = `${STEPS.indexOf(STEPS[st.step]) + 1}/${STEPS.length} · ${STEPS[st.step].name}`;
  live.querySelector('.txt').textContent = st.text;
  live.classList.toggle('branch', st.branch && st.step === 7);
  live.classList.remove('tick'); void live.offsetWidth; live.classList.add('tick');
  if (!force) cardSize = { w: card.offsetWidth, h: card.offsetHeight };
}
// Tampon de voyage : chaque lieu est resitué sur la vraie carte, avec la distance depuis le précédent.
const stamp = $('#stamp');
let lastGeo = null;
function haversineKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function showStamp(geo) {
  const fmt = (v, p, n) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? p : n}`;
  stamp.classList.remove('regattas');
  // En France, le nom de la ville suffit ; la carte n'apparaît que pour l'étranger.
  const local = geo.flag === 'FR';
  stamp.classList.toggle('simple', local);
  if (!local) renderGeoMap(stamp.querySelector('svg'), geo, lastGeo).catch(() => {});
  stamp.querySelector('.place').textContent = geo.place;
  stamp.querySelector('.coords').textContent = `${fmt(geo.lat, 'N', 'S')} · ${fmt(geo.lon, 'E', 'O')}`;
  const far = lastGeo && lastGeo.place !== geo.place ? Math.round(haversineKm(lastGeo, geo)) : 0;
  stamp.querySelector('.dist').textContent = far ? `${far.toLocaleString('fr-FR')} km depuis ${lastGeo.place}` : '';
  stamp.classList.toggle('far', far > 1000);
  lastGeo = geo;
  stamp.hidden = false;
  stamp.classList.remove('show'); void stamp.offsetWidth; stamp.classList.add('show');
}
// Bouée « Sportif de haut niveau » : tous les plans d'eau où j'ai régaté.
function showRegattas() {
  stamp.classList.remove('simple', 'far');
  stamp.classList.add('regattas');
  renderRegattaMap(stamp.querySelector('svg'), REGATTAS).then((far) => {
    stamp.querySelector('.dist').textContent = far.length ? `+ ${far.join(', ')}` : '';
  }).catch(() => {});
  stamp.querySelector('.place').textContent = `${REGATTAS.length} plans d’eau en régate`;
  stamp.querySelector('.coords').textContent = 'de la Bretagne à la Baltique';
  stamp.querySelector('.dist').textContent = '';
  stamp.hidden = false;
  stamp.classList.remove('show'); void stamp.offsetWidth; stamp.classList.add('show');
}
const docked = () => MOBILE_MQ.matches;
// À pied, quand la caméra cadre un lieu, la fiche se range à gauche et ne bouge plus.
const framedCard = () => mode === 'walk' && !!activeZone?.frame && !docked();
function placeCard() {
  if (!activeZone) return;
  card.classList.toggle('docked', docked());
  card.classList.toggle('side', (!!activeZone.cardSide || framedCard()) && !docked());
  if (docked() || !activeZone.anchor) { card.style.transform = ''; return; }
  // Certaines scènes (l'open space, les lieux cadrés à pied) se lisent en entier : la fiche se range à gauche.
  if (activeZone.cardSide || framedCard()) { card.style.transform = `translate(16px, ${84}px)`; return; }
  const p = toScreen(activeZone.anchor);
  const m = 16, top = 84;
  let x = THREE.MathUtils.clamp(p.x, cardSize.w / 2 + m, innerWidth - cardSize.w / 2 - m);
  const y = THREE.MathUtils.clamp(p.y - (activeZone.card.brand ? 46 : 22), cardSize.h + top, innerHeight - m);
  // Si la fiche recouvre le joueur (bateau ou marin), elle s'écarte sur le côté opposé.
  const me = toScreen(mode === 'walk' ? walker.root.position : boat.root.position);
  const pad = 50;
  if (me.x > x - cardSize.w / 2 - pad && me.x < x + cardSize.w / 2 + pad && me.y > y - cardSize.h - pad && me.y < y + pad) {
    const left = me.x - cardSize.w / 2 - pad * 1.5, right = me.x + cardSize.w / 2 + pad * 1.5;
    x = me.x > innerWidth / 2 ? left : right;
    x = THREE.MathUtils.clamp(x, cardSize.w / 2 + m, innerWidth - cardSize.w / 2 - m);
  }
  card.style.transform = `translate(${x - cardSize.w / 2}px, ${y - cardSize.h}px)`;
  // La pointe reste sous l'objet même quand la fiche est poussée contre un bord.
  card.style.setProperty('--tail-x', `${THREE.MathUtils.clamp(p.x - (x - cardSize.w / 2), 24, cardSize.w - 24)}px`);
}

// --- Carte : mini-carte en bas à gauche, grande carte avec les lieux à rejoindre en un clic.
const POI_GROUPS = [
  { title: 'Centres d’intérêt', ids: ['run', 'gym'] },
  { title: 'Flux IA', ids: ['agents'] },
  { title: 'Mon parcours', ids: EXPERIENCES.map((e) => e.id) },
  { title: 'Formation', ids: ['polytech', 'ronarch', 'guelph'] },
  { title: 'Lieux', ids: ['regate', 'phare', 'port'] },
];
const POI_NAMES = { regate: 'Régate en flotte', phare: 'Le Phare des maîtrises', agents: 'Open space des agents', run: 'Course à pied', gym: 'Musculation', formation: 'Formation', monde: 'International', perf: 'Zone perf', port: 'Ponton d’arrivée' };
// Décalage des noms sur la grande carte (le port est compact, les noms se chevaucheraient).
const MAP_LABEL_OFFSET = { agents: [0, -14, 'right'], run: [0, -14, 'left'], gym: [10, 5, 'left'], port: [0, 30, 'center'], perf: [10, 5, 'left'] };
const poiName = (z) => POI_NAMES[z.id] || z.card.title;
const zoneById = Object.fromEntries(world.zones.map((z) => [z.id, z]));
const mm = $('#minimap');
const big = $('#map-canvas');
// Fenêtre de monde affichée, cadrée sur le contenu (et non sur toute la mer).
const MAP_GROUPS = [
  { name: 'Centres d’intérêt', ids: ['run', 'gym'], at: 'gym' }, // la corniche fait le tour de l'île : on pose le nom sur le parc
  { name: 'Formation', ids: ['polytech', 'ronarch', 'guelph'] },
  { name: 'Emploi actuel', ids: ['kc'] },
  { name: 'Compétences', ids: ['phare'] },
  { name: 'Régate', ids: ['regate'] },
];
const MAP_SPAN = 800, MAP_CX = 25, MAP_CZ = -40;
const mapScale = (W) => W / MAP_SPAN;

const mapCam = new THREE.OrthographicCamera(-MAP_SPAN / 2, MAP_SPAN / 2, MAP_SPAN / 2, -MAP_SPAN / 2, 10, 6000);
mapCam.up.set(0, 0, -1); // nord en haut
mapCam.position.set(MAP_CX, 3000, MAP_CZ);
mapCam.lookAt(MAP_CX, 0, MAP_CZ);
const mapRenderer = new THREE.WebGLRenderer({ canvas: $('#map-gl'), antialias: true });
mapRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
mapRenderer.setSize(720, 720, false);

const miniTarget = new THREE.WebGLRenderTarget(256, 256);
miniTarget.texture.colorSpace = THREE.SRGBColorSpace;
const miniScene = new THREE.Scene();
const miniCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
miniScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: miniTarget.texture, toneMapped: false })));
let miniAge = 1e9;
function renderMinimap(dt) {
  miniAge += dt;
  if (miniAge > (IS_MOBILE ? 1 : 0.4)) {
    // Le monde vu d'en haut, recalculé ~2,5 fois par seconde (1 fois sur téléphone).
    miniAge = 0;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(miniTarget);
    renderer.render(scene, mapCam);
    renderer.setRenderTarget(null);
    renderer.shadowMap.autoUpdate = true;
  }
  const r = mm.getBoundingClientRect();
  const y = innerHeight - r.bottom;
  renderer.autoClear = false;
  renderer.setScissorTest(true);
  renderer.setViewport(r.left, y, r.width, r.height);
  renderer.setScissor(r.left, y, r.width, r.height);
  renderer.render(miniScene, miniCam);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.autoClear = true;
}

// Calque 2D au-dessus du rendu 3D : bateau, marin, noms des lieux.
function drawMap(canvas, { names = false, highlight = null } = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, s = mapScale(W), k = W / 340;
  const X = (x) => W / 2 + (x - MAP_CX) * s, Y = (z) => W / 2 + (z - MAP_CZ) * s;
  ctx.clearRect(0, 0, W, W);
  // Les bouées sont minuscules vues d'aussi haut : une pastille aux couleurs de la marque les signale.
  for (const b of world.map.buoys) {
    ctx.fillStyle = b.color; ctx.strokeStyle = '#fffdf8'; ctx.lineWidth = 1.5 * k;
    ctx.beginPath(); ctx.arc(X(b.x), Y(b.z), 4 * k, 0, 7); ctx.fill(); ctx.stroke();
  }
  if (names) {
    ctx.font = `700 ${11 * k}px "Space Grotesk", sans-serif`;
    ctx.textAlign = 'center';
    // Sur la carte, des catégories plutôt que le détail : un nom par groupe de lieux, posé au centre du groupe.
    for (const grp of MAP_GROUPS) {
      const zs = grp.ids.map((id) => zoneById[id]).filter(Boolean);
      if (!zs.length) continue;
      const pts = (grp.at ? [zoneById[grp.at]] : zs).map((z) => z.land || z);
      const x = pts.reduce((t, p) => t + p.x, 0) / pts.length, z = pts.reduce((t, p) => t + p.z, 0) / pts.length;
      const on = grp.ids.includes(highlight);
      ctx.textAlign = 'center';
      ctx.fillStyle = on ? '#ff6a4d' : '#1d2533';
      ctx.beginPath(); ctx.arc(X(x), Y(z), 4 * k, 0, 7); ctx.fill();
      ctx.lineWidth = 4 * k; ctx.strokeStyle = '#fffdf8'; ctx.strokeText(grp.name, X(x), Y(z) - 10 * k);
      ctx.fillText(grp.name, X(x), Y(z) - 10 * k);
    }
    // Survol d'une étape du parcours dans la liste : on l'affiche quand même.
    const hz = zoneById[highlight];
    if (hz?.card.brand && EXPERIENCES.some((e) => e.id === highlight)) {
      ctx.fillStyle = '#ff6a4d';
      ctx.lineWidth = 4 * k; ctx.strokeStyle = '#fffdf8';
      ctx.strokeText(poiName(hz), X(hz.x), Y(hz.z) - 10 * k);
      ctx.fillText(poiName(hz), X(hz.x), Y(hz.z) - 10 * k);
    }
  }
  if (mode === 'walk') {
    ctx.fillStyle = '#ff6a4d'; ctx.strokeStyle = '#1d2533'; ctx.lineWidth = 2 * k;
    ctx.beginPath(); ctx.arc(X(walker.pos.x), Y(walker.pos.y), 5 * k, 0, 7); ctx.fill(); ctx.stroke();
  }
  ctx.save();
  ctx.translate(X(boat.pos.x), Y(boat.pos.y));
  ctx.rotate(-boat.heading);
  ctx.scale(k, k);
  ctx.fillStyle = '#ff6a4d'; ctx.strokeStyle = '#1d2533'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(8, -9); ctx.lineTo(-8, -9); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

const mapOverlay = $('#map');
let mapHover = null;
const poiList = $('#map-pois');
POI_GROUPS.forEach((g) => {
  const h = document.createElement('h3');
  h.textContent = g.title;
  poiList.appendChild(h);
  g.ids.forEach((id) => {
    const z = zoneById[id];
    if (!z) return;
    const b = document.createElement('button');
    b.className = 'poi';
    b.innerHTML = z.card.brand ? `<i style="background:${z.card.brand.color}"></i><span></span><em></em>` : '<span></span>';
    b.querySelector('span').textContent = poiName(z);
    if (z.card.brand) b.querySelector('em').textContent = z.card.kicker;
    b.addEventListener('click', () => goTo(z));
    b.addEventListener('pointerenter', () => { mapHover = id; });
    b.addEventListener('pointerleave', () => { mapHover = null; });
    poiList.appendChild(b);
    // Sous le Phare : les technologies maîtrisées, en petites pastilles (la carte sert aussi de CV rapide).
    if (id === 'phare') {
      const sk = document.createElement('div');
      sk.className = 'poi-skills';
      sk.innerHTML = SKILLS.map((g) => `<div><em>${g.group}</em>${g.items.map((i) => `<span>${i}</span>`).join('')}</div>`).join('');
      poiList.appendChild(sk);
    }
  });
});
function openMap() { start(); mapOverlay.hidden = false; }
function closeMap() { mapOverlay.hidden = true; }
mm.addEventListener('click', openMap);
$('[data-close-map]').addEventListener('click', closeMap);
mapOverlay.addEventListener('click', (e) => { if (e.target === mapOverlay) closeMap(); });
big.addEventListener('click', (e) => {
  const r = big.getBoundingClientRect();
  const W = big.width, s = mapScale(W);
  const wx = (((e.clientX - r.left) / r.width) * W - W / 2) / s + MAP_CX;
  const wz = (((e.clientY - r.top) / r.height) * W - W / 2) / s + MAP_CZ;
  let best = null, bd = 60;
  for (const z of world.zones) { const d = Math.hypot(z.x - wx, z.z - wz); if (d < bd) { bd = d; best = z; } }
  if (best) goTo(best);
});

// Téléportation en fondu : le bateau est posé dans l'eau au plus près du lieu, cap au nord.
function goTo(z) {
  closeMap();
  const fade = $('#fade');
  fade.classList.add('on');
  setTimeout(() => {
    // Lieu à terre : le bateau est amarré au ponton du port, jamais posé dans l'île.
    const p = z.land ? new THREE.Vector2(world.berth.x, world.berth.z) : new THREE.Vector2(z.x, z.z + 0.1);
    for (let i = 0; i < 4; i++) world.collide(p, 8);
    boat.pos.copy(p);
    boat.heading = Math.PI;
    boat.speed = 0;
    // Le modèle suit tout de suite (sinon il reste à l'ancien endroit tant que la fiche fige le bateau).
    boat.update(0, { steer: 0, power: 0, brake: true }, null);
    // Lieu à terre : on pose le marin devant ce qu'il vient voir.
    const spot = z.land && (world.landingSpot(z.land.x, z.land.z, 30) || world.landingSpot(p.x, p.y, 140));
    if (spot) disembark(spot);
    else { mode = 'boat'; walker.root.visible = false; }
    focus.set(spot ? spot.x : p.x, 0, spot ? spot.y : p.y);
    fade.classList.remove('on');
  }, 260);
}

// --- Régate : inscription, compte à rebours, classement, messages de règles.
const raceHud = $('#race'), toast = $('#toast');
let toastTimer = 0;
const raceBtn = card.querySelector('.race-btn');
raceBtn.addEventListener('click', () => {
  if (boat.motor) {
    showToast('La régate est réservée aux navigants : recharge la page et choisis « Oui, je navigue ».', 'warn');
    return;
  }
  if (!race.join(boat)) showToast('Course en cours : attends la prochaine.', 'warn');
});
function showToast(text, kind = 'info') {
  toast.textContent = text;
  toast.className = `toast ${kind}`;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
}
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// --- Photo de profil : un clic sur l'avatar l'agrandit.
const photoEl = $('#photo');
$('.avatar-btn').addEventListener('click', () => { photoEl.hidden = false; });
photoEl.addEventListener('click', (e) => { if (e.target === photoEl || e.target.closest('.close')) photoEl.hidden = true; });
addEventListener('keydown', (e) => { if (e.key === 'Escape') photoEl.hidden = true; });

// --- Rapport de perf d'après course : traces, vitesses et TWA moyens par bord, manœuvres.
const reportEl = $('#race-report');
reportEl.querySelector('.close').addEventListener('click', () => { reportEl.hidden = true; });
reportEl.addEventListener('click', (e) => { if (e.target === reportEl) reportEl.hidden = true; });
function openReport() {
  const rep = race.report;
  if (!rep) return;
  const me = rep.rows.find((r) => r.human);
  reportEl.querySelector('.rr-title').textContent = me ? `${me.rank}${me.rank === 1 ? 'er' : 'e'} sur ${rep.rows.length}${me.finished !== null ? ` en ${fmtTime(me.time)}` : ' · non classé'}` : 'Régate';
  reportEl.querySelector('.rr-sub').textContent = `Parcours au vent / sous le vent · vent du nord · ${rep.at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  const f1 = (v) => (v == null ? '—' : v.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }));
  const f0 = (v) => (v == null ? '—' : `${Math.round(v)}°`);
  reportEl.querySelector('.rr-table').innerHTML = `<thead><tr><th></th><th>Bateau</th><th>Temps</th><th>Dist.</th><th>V moy</th><th>V près</th><th>TWA près</th><th>V portant</th><th>TWA portant</th><th>Virements</th><th>Empannages</th></tr></thead><tbody>${
    rep.rows.map((r) => `<tr class="${r.human ? 'me' : ''}"><td>${r.rank}</td><td><i style="background:${r.color}"></i>${r.name}</td><td>${r.finished !== null ? fmtTime(r.time) : 'DNF'}</td><td>${Math.round(r.dist)} m</td><td>${f1(r.v)}</td><td>${f1(r.beat?.v)}</td><td>${f0(r.beat?.twa)}</td><td>${f1(r.run?.v)}</td><td>${f0(r.run?.twa)}</td><td>${r.tacks}</td><td>${r.gybes}</td></tr>`).join('')
  }</tbody>`;
  reportEl.hidden = false;
  drawReportMap(reportEl.querySelector('.rr-map'), rep);
}
function drawReportMap(cv, rep) {
  const { line, mark } = COURSE;
  const dpr = Math.min(devicePixelRatio, 2), W = cv.clientWidth || 420, H = cv.clientHeight || 520;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  let x0 = Math.min(line.x0, mark.x) - 20, x1 = Math.max(line.x1, mark.x) + 20, z0 = mark.z - 20, z1 = line.z + 30;
  for (const r of rep.rows) for (const [x, z] of r.track) { x0 = Math.min(x0, x - 8); x1 = Math.max(x1, x + 8); z0 = Math.min(z0, z - 8); z1 = Math.max(z1, z + 8); }
  const s = Math.min(W / (x1 - x0), H / (z1 - z0));
  const X = (x) => W / 2 + (x - (x0 + x1) / 2) * s, Y = (z) => H / 2 + (z - (z0 + z1) / 2) * s;
  ctx.fillStyle = '#0b1a2e'; ctx.fillRect(0, 0, W, H);
  // Quadrillage de 20 m, comme un fond de carte d'analyse.
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
  for (let x = Math.ceil(x0 / 20) * 20; x < x1; x += 20) { ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), H); ctx.stroke(); }
  for (let z = Math.ceil(z0 / 20) * 20; z < z1; z += 20) { ctx.beginPath(); ctx.moveTo(0, Y(z)); ctx.lineTo(W, Y(z)); ctx.stroke(); }
  // Ligne de départ / arrivée et marques.
  ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(X(line.x0), Y(line.z)); ctx.lineTo(X(line.x1), Y(line.z)); ctx.stroke(); ctx.setLineDash([]);
  const dot = (x, z, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(X(x), Y(z), r, 0, 7); ctx.fill(); };
  dot(line.x0, line.z, 4, '#ff9f1c'); dot(mark.x, mark.z, 5, '#ffc845');
  ctx.fillStyle = '#e8eef5'; ctx.fillRect(X(line.x1) - 3, Y(line.z) - 6, 6, 12);
  // Flèche de vent (du nord).
  ctx.strokeStyle = '#7fd6ff'; ctx.fillStyle = '#7fd6ff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W - 22, 14); ctx.lineTo(W - 22, 40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W - 27, 34); ctx.lineTo(W - 22, 42); ctx.lineTo(W - 17, 34); ctx.fill();
  ctx.font = '600 10px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('VENT', W - 22, 54);
  // Les traces : le visiteur par-dessus, plus épais.
  for (const r of [...rep.rows].sort((a, b) => a.human - b.human)) {
    ctx.strokeStyle = r.color; ctx.lineWidth = r.human ? 3 : 2; ctx.lineJoin = ctx.lineCap = 'round';
    ctx.globalAlpha = r.human ? 1 : 0.85;
    ctx.beginPath(); r.track.forEach(([x, z], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(x), Y(z))); ctx.stroke();
    const [ex, ez] = r.track[r.track.length - 1];
    dot(ex, ez, 3.5, r.color);
    ctx.globalAlpha = 1;
  }
}
function updateRaceUi() {
  while (race.events.length) {
    const e = race.events.shift();
    if (e.kind === 'report') setTimeout(openReport, 1200);
    else if (e.kind !== 'results') showToast(e.text, e.kind);
  }
  if (!raceBtn.hidden) {
    raceBtn.disabled = race.state === 'racing' || race.playerIn;
    raceBtn.textContent = race.playerIn ? 'Inscrit ✔' : race.state === 'racing' ? 'Course en cours…' : race.state === 'countdown' ? `Rejoindre (départ dans ${Math.ceil(race.timer)} s)` : 'Participer (départ dans 30 s)';
  }
  const show = race.playerIn || (race.state === 'results' && race.results.some((c) => c.human));
  raceHud.hidden = !show;
  if (!show) return;
  if (race.state === 'countdown') {
    const over = boat.pos.y < COURSE.line.z;
    raceHud.innerHTML = `<b>🏁 Départ dans ${fmtTime(Math.ceil(race.timer))}</b><span>${over ? '⚠️ Tu es au-dessus de la ligne : redescends avant le signal !' : 'Reste sous la ligne (au sud) jusqu’au signal.'}</span>`;
  } else if (race.state === 'racing') {
    const st = race.standings(boat);
    const me = st.findIndex((c) => c.human) + 1;
    const pl = race.player;
    const leg = pl.ocs ? '🚩 OCS : repasse sous la ligne' : pl.phase === 'pre' ? 'Passe la ligne vers le nord' : pl.phase === 'beat' ? 'Au près → bouée jaune' : pl.phase === 'run' ? 'Au portant → ligne d’arrivée' : 'Arrivé';
    raceHud.innerHTML = `<b>${me}<sup>${me === 1 ? 'er' : 'e'}</sup> / ${st.length} · ${fmtTime(race.clock)}</b><span>${leg}</span>`;
  } else if (race.state === 'results') {
    raceHud.innerHTML = `<b>🏁 Classement</b><ol>${race.standings(boat).map((c) => `<li class="${c.human ? 'me' : ''}">${c.name}${c.finished !== null ? ` <i>${fmtTime(c.finished)}</i>` : ' <i>—</i>'}</li>`).join('')}</ol>`;
  }
}

// --- La carte des savoirs : concepts à gauche, réalisations à droite, reliés par la donnée.
const savoirs = $('#savoirs');
const sv = savoirs.querySelector('.sv-graph');
sv.innerHTML = `<svg class="sv-links"></svg>
  <div class="sv-col sv-concepts">${CONCEPTS.map((c) => `<button class="sv-node" data-c="${c.id}"><b>${c.name}</b><small>${c.hint}</small></button>`).join('')}</div>
  <div class="sv-col sv-works">${WORKS.map((w) => `<article class="sv-work" data-w="${w.id}"><b>${w.name}</b><small>${w.where}</small>
    <p><em>Moi</em> ${w.me}</p><p><em>L’IA</em> ${w.ai}</p>${w.zone ? `<button class="sv-go" data-zone="${w.zone}">y aller →</button>` : ''}</article>`).join('')}</div>`;
function drawLinks(focus = null) {
  const svg = sv.querySelector('.sv-links');
  const box = sv.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  let html = '';
  for (const w of WORKS) for (const cid of w.concepts) {
    const a = sv.querySelector(`[data-c="${cid}"]`).getBoundingClientRect();
    const b = sv.querySelector(`[data-w="${w.id}"]`).getBoundingClientRect();
    const x1 = a.right - box.left, y1 = a.top + a.height / 2 - box.top, x2 = b.left - box.left, y2 = b.top + b.height / 2 - box.top;
    const on = !focus || focus === cid || focus === w.id;
    html += `<path class="${on ? 'on' : ''}" d="M${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}"/>`;
  }
  svg.innerHTML = html;
  sv.querySelectorAll('.sv-node').forEach((n) => n.classList.toggle('dim', !!focus && !(focus === n.dataset.c || WORKS.some((w) => w.id === focus && w.concepts.includes(n.dataset.c)))));
  sv.querySelectorAll('.sv-work').forEach((n) => n.classList.toggle('dim', !!focus && !(focus === n.dataset.w || WORKS.some((w) => w.id === n.dataset.w && w.concepts.includes(focus)))));
}
sv.addEventListener('pointerover', (e) => {
  const n = e.target.closest('[data-c],[data-w]');
  drawLinks(n ? n.dataset.c || n.dataset.w : null);
});
sv.addEventListener('pointerleave', () => drawLinks());
sv.addEventListener('click', (e) => {
  const go = e.target.closest('.sv-go');
  if (go) { savoirs.hidden = true; goTo(zoneById[go.dataset.zone]); }
});
function openSavoirs() { savoirs.hidden = false; requestAnimationFrame(() => drawLinks()); }
document.querySelectorAll('[data-open-concepts]').forEach((b) => b.addEventListener('click', openSavoirs));
savoirs.querySelector('.close').addEventListener('click', () => { savoirs.hidden = true; });
savoirs.addEventListener('click', (e) => { if (e.target === savoirs) savoirs.hidden = true; });
addEventListener('resize', () => { if (!savoirs.hidden) drawLinks(); });

// --- L'équipe d'agents : moi au centre, les agents en orbite.
const teamEl = $('#team-orbit');
teamEl.innerHTML = `<div class="me-node"><b>BP</b><span>L’ingénieur · chef d’équipe</span><small>exprime le besoin · débloque · relit chaque diff · valide</small></div>`
  + TEAM.map((a, i) => `<article class="agent" style="--i:${i};--n:${TEAM.length}"><code>${a.file}</code><b>${a.name}</b><small>quand : ${a.when}</small><p>${a.job}</p></article>`).join('');
function openTeam() { $('#team').hidden = false; }
function closeTeam() { $('#team').hidden = true; }
document.querySelectorAll('[data-open-team]').forEach((b) => b.addEventListener('click', openTeam));
$('[data-close-team]').addEventListener('click', closeTeam);
$('#team').addEventListener('click', (e) => { if (e.target.id === 'team') closeTeam(); });

// --- Intro et version rapide.
$('#brand-name').textContent = PROFILE.name;
$('#brand-title').textContent = PROFILE.title;
$('#intro-name').textContent = PROFILE.name;
$('#intro-title').textContent = `${PROFILE.title} · ${PROFILE.tagline}`;
// Navigant : le foiler, avec le vent. Sinon (ou sans réponse) : un semi-rigide à moteur.
const SAILOR_BY_DEFAULT = new URLSearchParams(location.search).has('navigant');
function start(choice = SAILOR_BY_DEFAULT ? 'sail' : 'rib') {
  if (started) return;
  started = true;
  $('#intro').hidden = true;
  if (choice === 'rib') {
    const rib = new Rib();
    rib.pos.copy(boat.pos);
    rib.heading = boat.heading;
    scene.remove(boat.root);
    scene.add(rib.root);
    boat = rib;
    $('.readout .small').textContent = 'semi-rigide · moteur';
  }
}
$('#start-sail').addEventListener('click', () => start('sail'));
$('#start-rib').addEventListener('click', () => start('rib'));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
$('#cv-body').innerHTML = `
  <p class="eyebrow">Curriculum vitae</p>
  <h1>${esc(PROFILE.name)}</h1>
  <p class="lead">${esc(PROFILE.title)} · ${esc(PROFILE.tagline)}</p>
  <div class="links">${PROFILE.links.map((l) => `<a class="btn ghost" href="${esc(l.href)}"${l.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(l.label)}</a>`).join('')}</div>
  <h3>Expérience</h3>
  ${[...EXPERIENCES].reverse().map((e) => `
    <div class="item"><div class="when">${esc(e.dates)}</div>
      <div><b>${esc(e.role)}</b><span>${esc(e.org)} · ${esc(e.place)}</span><p>${esc(e.body)}</p></div></div>`).join('')}
  <h3>Formation</h3>
  ${EDUCATION.map((e) => `
    <div class="item"><div class="when">${esc(e.dates)}</div>
      <div><b>${esc(e.school)}</b><span>${esc(e.degree)}</span>${e.body ? `<p>${esc(e.body)}</p>` : ''}</div></div>`).join('')}
  <h3>Centres d’intérêt</h3>
  ${Object.values(INTERESTS).map((i) => `
    <div class="item"><div class="when">${esc(i.tags.join(' · '))}</div><div><b>${esc(i.title)}</b><p>${esc(i.body)}</p></div></div>`).join('')}
`;
function openCv() { $('#cv').hidden = false; }
function closeCv() { $('#cv').hidden = true; }
document.querySelectorAll('[data-open-cv]').forEach((b) => b.addEventListener('click', openCv));
document.querySelector('[data-close-cv]').addEventListener('click', closeCv);
$('#cv').addEventListener('click', (e) => { if (e.target.id === 'cv') closeCv(); });

// --- Boucle
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const CAM_OFFSET = new THREE.Vector3(0, 125, 82);
// Vue d'accueil large : le nom, le bateau, la bouée « Sportif de haut niveau » et le match race.
// Mode carte du monde (JRPG) : entre deux régions, vue d'ensemble, gros bateau, déplacement rapide.
// C'est aussi la vue d'arrivée sur la page : on découvre tout le plan d'eau et le nom au départ.
const OVERWORLD = { x: 25, z: -45, zoom: 8.6, boatScale: 4.6, travel: 2.4 };
const INTRO_VIEW = { x: OVERWORLD.x, z: OVERWORLD.z, zoom: 1 };
let ow = 1;
let frozen = false;
let walkZoomS = 1;
let dayTimer = 0;
const OVERWORLD_TRAVEL = false; // true : gros bateau + vue globale entre les régions (essai JRPG)
const focus = new THREE.Vector3(INTRO_VIEW.x, 0, INTRO_VIEW.z);
let zoneZoom = 1;
camera.position.copy(focus).add(CAM_OFFSET);
camera.lookAt(focus);
const emitters = [], aiEmitters = [];
const clock = new THREE.Clock();
const portrait = () => innerHeight > innerWidth;
const camRight = new THREE.Vector3();
let lastSheetH = '';

let simTime = 0;
// Résolution adaptative (téléphone) : si les images arrivent trop lentement, on rend moins de pixels ;
// si ça redevient fluide, on remonte doucement. Le décor reste net, seule la finesse varie.
const PR_MAX = Math.min(devicePixelRatio, IS_MOBILE ? 1.5 : 2), PR_MIN = IS_MOBILE ? 0.75 : 1;
let frameEma = 1 / 60, prTimer = 0;
function adaptResolution(raw) {
  if (document.hidden || raw > 0.25) return; // onglet en pause ou à-coup isolé : on ignore
  frameEma += (raw - frameEma) * 0.05;
  prTimer += raw;
  if (prTimer < 1.5) return;
  const pr = renderer.getPixelRatio();
  let next = pr;
  if (frameEma > 1 / 40 && pr > PR_MIN) next = Math.max(PR_MIN, pr - 0.15);
  else if (frameEma < 1 / 56 && pr < PR_MAX) next = Math.min(PR_MAX, pr + 0.1);
  if (next !== pr) { renderer.setPixelRatio(next); resize(); prTimer = -1.5; } else prTimer = 0;
}
function frame() {
  const raw = clock.getDelta();
  adaptResolution(raw);
  tick(Math.min(raw, 1 / 20));
  window.__pf && window.__pf.frames++;
  requestAnimationFrame(frame);
}

function tick(dt) {
  simTime += dt;
  const t = simTime;

  const input = readInput();
  if (mode === 'walk') {
    // À terre, le bateau reste amarré là où on l'a laissé.
    boat.update(dt, { steer: 0, power: 0, brake: true, moor: true }, world.collide);
    recordRun(dt);
    if (walker.pull) {
      const wi = readWalkInput();
      const reps = walker.updatePull(dt, wi.x !== 0 || wi.z !== 0);
      if (reps) countPullups(reps);
    } else walker.update(dt, readWalkInput(), world);
  } else {
    // Fiche ouverte et commandes lâchées : le bateau se fige en gardant sa vitesse (il repart d'un coup
    // dès qu'on reprend la barre) et le décor passe en noir et blanc pour mettre l'information en avant.
    // Seulement une fois que le visiteur a pris la barre : jamais de noir et blanc « tout seul ».
    frozen = started && touched && !!activeZone && !card.hidden && !input.any && !race.playerIn;
    if (!frozen) boat.update(dt, input, world.collide);
  }
  if (mode === 'walk') frozen = false;
  canvas.classList.toggle('frozen', frozen);
  updateAction(dt);
  race.update(dt, boat);
  updateRaceUi();
  // À pied, dans un lieu (bâtiment, parc, corniche) : la caméra se détache du marin et cadre le lieu,
  // en s'élargissant juste assez pour le garder dans l'image ; un petit lieu garde un minimum de recul.
  // Entre deux lieux, elle suit le marin et recule pour montrer la ville.
  const framing = mode === 'walk' ? activeZone?.frame : null;
  const walkTarget = framing
    ? THREE.MathUtils.clamp(Math.max(framing.r, Math.hypot(walker.pos.x - framing.x, walker.pos.y - framing.z) + 8) / 36.5, 0.82, 2.2) / 0.8
      * (IS_MOBILE && !portrait() ? 0.8 : 1) // téléphone en paysage : peu de hauteur, on serre le cadre
    : activeZone ? (activeZone.walkZoom ?? 1) : world.inPort(walker.pos) ? (IS_MOBILE ? 1.4 : 3.4) : 1.2; // téléphone : on garde le marin lisible
  walkZoomS = THREE.MathUtils.damp(walkZoomS, walkTarget, 1.8, dt);

  // Lumière du jour : recalculée toutes les deux secondes à partir de l'heure locale.
  dayTimer -= dt;
  if (dayTimer <= 0) {
    dayTimer = 2;
    const h = currentHour();
    const p = applyDayNight({ scene, sun, hemi, water: world.water, beam: world.phare.beam }, h);
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    $('#clock').textContent = `${p.night > 0.5 ? '🌙' : '☀️'} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  // Télémétrie : toujours enregistrée, affichée et « envoyée » au phare quand on s'en approche.
  recorder.sample(dt, t, boat);
  const near = activeZone?.telemetry && mode === 'boat';
  boat.root.localToWorld(mastTop.set(0, 14, 1));
  stream.update(dt, t, mastTop, world.phare.lamp, near ? 1 : 0);
  $('#telemetry').hidden = !near;
  if (near) telemetry.render(t);
  if (activeZone?.live) renderLive();
  world.update(dt, t, boat);
  const vpScale = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * renderer.getPixelRatio();
  wake.update(dt, boat.wakePoints(emitters), frozen ? 0 : boat.speed, boat.height > 0.6, vpScale);
  // Gerbes des foils : le bateau du visiteur et les foilers de la régate.
  if (boat.height > 0.6 && !boat.motor) spray.feed(dt, boat, emitters, boat.forward, frozen ? 0 : boat.speed);
  else spray.feed(dt, boat, [], null, 0);
  for (const a of race.ai) {
    const ab = a.boat;
    if (ab.height > 0.6 && Math.abs(ab.pos.x - focus.x) + Math.abs(ab.pos.y - focus.z) < 260) spray.feed(dt, ab, ab.wakePoints(aiEmitters), ab.forward, ab.speed);
    else spray.feed(dt, ab, [], null, 0);
  }
  spray.update(frozen ? 0 : dt, vpScale);
  streaks.update(dt, focus);

  // Vue d'ensemble seulement à l'arrivée sur la page ; le mode « carte du monde » en navigation est désactivé.
  const travelling = !started || (OVERWORLD_TRAVEL && mode === 'boat' && !world.inRegion(boat.pos));
  ow = THREE.MathUtils.damp(ow, travelling ? 1 : 0, 2.2, dt);
  boat.root.scale.setScalar(1 + (OVERWORLD.boatScale - 1) * ow);
  boat.travel = 1 + (OVERWORLD.travel - 1) * ow;
  $('#hint').classList.toggle('overworld', ow > 0.5);

  updateZones();
  zoneZoom = THREE.MathUtils.damp(zoneZoom, activeZone?.zoom ?? 1, 1.5, dt);
  const ahead = boat.forward.multiplyScalar(Math.min(boat.speed, 26) * 1.1);
  // Pendant l'intro, on cadre le bateau et le nom flottant ensemble.
  let fx = started ? boat.pos.x + ahead.x : INTRO_VIEW.x;
  let fz = started ? boat.pos.y + ahead.y : INTRO_VIEW.z;
  if (mode === 'walk') { fx = framing ? framing.x : walker.pos.x; fz = framing ? framing.z : walker.pos.y; }
  // Téléphone : quand le tiroir de fiche est ouvert en bas, on remonte la scène pour garder le bateau visible.
  // Une zone peut attirer le regard vers ce qu'elle montre (le café, la piste…).
  if (started && activeZone?.look && !framing) {
    const w = mode === 'walk' ? 0.3 : 0.5;
    fx += (activeZone.look.x - fx) * w;
    fz += (activeZone.look.z - fz) * w;
  }
  // Mode carte du monde : on glisse vers la vue d'ensemble, centrée entre le bateau et le centre de la carte.
  fx = THREE.MathUtils.lerp(fx, OVERWORLD.x * 0.7 + boat.pos.x * 0.3, ow);
  fz = THREE.MathUtils.lerp(fz, OVERWORLD.z * 0.7 + boat.pos.y * 0.3, ow);
  // Téléphone : la fiche occupe la gauche de l'écran, on recadre pour que le bateau reste au centre de la partie libre.
  // Idem sur ordinateur quand un lieu est cadré à pied : la fiche est rangée à gauche, le lieu se centre à droite.
  // Téléphone en portrait : la fiche est un tiroir en bas, on remonte le lieu dans la partie libre au-dessus.
  const sheet = docked() && portrait() && !card.hidden && started;
  if (sheet) {
    const viewH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.distanceTo(focus);
    fz += ((card.offsetHeight / innerHeight) * 0.5 * viewH) / Math.sin(Math.atan2(CAM_OFFSET.y, CAM_OFFSET.z)); // vers le bas de l'écran = vers le sud
  } else if ((docked() || framing) && !card.hidden && started) {
    const viewW = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.distanceTo(focus) * camera.aspect;
    const shift = ((card.offsetWidth + (docked() ? 0 : 16)) / innerWidth) * 0.5 * viewW;
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    fx -= camRight.x * shift;
    fz -= camRight.z * shift;
  }
  // Hauteur du tiroir : le bouton d'action et les messages se placent juste au-dessus.
  const sheetH = sheet ? `${card.offsetHeight}px` : '0px';
  if (sheetH !== lastSheetH) { lastSheetH = sheetH; document.documentElement.style.setProperty('--sheet-h', sheetH); }
  focus.x = THREE.MathUtils.damp(focus.x, fx, 2.5, dt);
  focus.z = THREE.MathUtils.damp(focus.z, fz, 2.5, dt);
  // À pied : facteur 0,8 = vue un peu plus large, le low poly se lit mieux de plus haut.
  const zoom = THREE.MathUtils.lerp(
    userZoom * (mode === 'walk' ? 0.8 * walkZoomS : zoneZoom) * (portrait() ? 1.5 : 1) * (started ? 1 : INTRO_VIEW.zoom),
    OVERWORLD.zoom * (portrait() ? 1.5 : 1), ow);
  camera.position.set(focus.x + CAM_OFFSET.x * zoom, CAM_OFFSET.y * zoom, focus.z + CAM_OFFSET.z * zoom);
  camera.lookAt(focus);

  sun.position.set(focus.x - 70, 160, focus.z + 50);
  sun.target.position.copy(focus);

  $('#speed').textContent = (boat.speed * 1.944).toFixed(1);
  $('#foiling').classList.toggle('on', boat.height > 0.8);
  if (!boat.motor) $('#twa').textContent = Math.round(THREE.MathUtils.radToDeg(boat.twa));

  renderer.render(scene, camera);
  renderMinimap(dt);
  merger.update(simTime);
  updateLabels(focus);
  placeCard();
  if (activeZone?.id === 'run' && !card.hidden) renderActivity(dt);
  // Hauteur du tiroir (mobile) : le bouton d'action et les messages se placent au-dessus.
    drawMap(mm);
  if (!mapOverlay.hidden) {
    mapRenderer.render(scene, mapCam);
    drawMap(big, { names: true, highlight: mapHover });
  }
}
requestAnimationFrame(frame);

// Accès debug depuis la console.
window.__pf = {
  get boat() { return boat; },
  race,
  walker,
  camera, world, renderer, scene,
  frames: 0,
  // Avance la simulation sans requestAnimationFrame (onglet en arrière-plan, captures).
  step(seconds, dt = 1 / 30) { for (let i = 0; i < seconds / dt; i++) tick(dt); },
  teleport(x, z, h = boat.heading) { boat.pos.set(x, z); boat.heading = h; focus.set(x, 0, z); },
};
