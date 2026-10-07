import * as THREE from 'three';
import { solid } from './toon.js';
import { Boat } from './boat.js';

// Régate en flotte à l'ouest du plan d'eau : 7 foilers IA (même physique que le joueur),
// départ au sud, bouée au vent au nord, arrivée sur la ligne de départ.
// Règles de base : bâbord amure s'écarte de tribord amure ; au vent s'écarte de sous le vent ;
// le bateau en route libre derrière s'écarte de celui devant.

export const COURSE = { line: { z: 140, x0: -232, x1: -148 }, mark: { x: -190, z: -60 }, axis: -190 };
const CLOSE_HAULED = 2.27; // ≈ 50° du vent : meilleur VMG au près avec la polaire du jeu
const COUNTDOWN = 30;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const FLEET = [
  { label: '1', accent: '#4d7cff' }, { label: '2', accent: '#2f9e55' }, { label: '3', accent: '#ffc845' },
  { label: '4', accent: '#a25dd9' }, { label: '5', accent: '#3ec7c2' }, { label: '6', accent: '#e8404a' }, { label: '7', accent: '#1d2533' },
];

function committeeBoat() {
  const g = new THREE.Group();
  g.add(solid(new THREE.BoxGeometry(3.6, 1.4, 9).translate(0, 0.5, 0), '#f6f1e7', { outlineWidth: 0.06 }));
  g.add(solid(new THREE.BoxGeometry(2.6, 1.6, 3).translate(0, 2, -1), '#14275b', { outlineWidth: 0.05 }));
  g.add(solid(new THREE.CylinderGeometry(0.07, 0.07, 6, 4).translate(0, 4.2, 2), '#9aa3ad', { outlineWidth: 0 }));
  const flag = solid(new THREE.BoxGeometry(0.05, 1.2, 1.8).translate(0, 6.4, 2.9), '#ff6a4d', { outlineWidth: 0 });
  g.add(flag);
  g.userData.flag = flag;
  flag.userData.dynamic = true; // pavillon amené au départ
  return g;
}
function bigMark(color) {
  const g = new THREE.Group();
  g.add(solid(new THREE.CylinderGeometry(1.8, 2.2, 5, 10).translate(0, 1.8, 0), color, { outlineWidth: 0.08 }));
  g.add(solid(new THREE.SphereGeometry(1.8, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 4.3, 0), color, { outlineWidth: 0.08 }));
  return g;
}

export class Race {
  constructor(scene, world) {
    this.world = world;
    this.state = 'idle';
    this.timer = 20; // première course automatique (sans le joueur) dans 20 s
    this.clock = 0;
    this.playerIn = false;
    this.player = null;
    this.results = [];
    this.events = []; // messages à afficher (règles, départ…)
    const { line, mark } = COURSE;

    this.committee = committeeBoat();
    this.committee.position.set(line.x0, 0, line.z);
    scene.add(this.committee);
    const pin = bigMark('#ff9f1c');
    pin.scale.setScalar(0.6);
    pin.position.set(line.x1, 0, line.z);
    scene.add(pin);
    const wm = bigMark('#ffc845');
    wm.position.set(mark.x, 0, mark.z);
    scene.add(wm);
    world.addObstacle({ x: line.x0, z: line.z, r: 5 });
    world.addObstacle({ x: line.x1, z: line.z, r: 2 });
    world.addObstacle({ x: mark.x, z: mark.z, r: 2.6 });
    const dash = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75 });
    for (let k = 1; k < 16; k += 2) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.5).rotateX(-Math.PI / 2), dash);
      d.position.set(THREE.MathUtils.lerp(line.x0, line.x1, k / 16), 0.1, line.z);
      scene.add(d);
    }

    // La flotte IA.
    this.ai = FLEET.map((f, i) => {
      const boat = new Boat({ label: f.label, accent: f.accent, hullColor: i % 2 ? '#f6f1e7' : '#e7eef4' });
      const slot = THREE.MathUtils.lerp(line.x0 + 18, line.x1 - 8, i / (FLEET.length - 1)); // pas collé au comité
      boat.pos.set(slot, line.z + 28 + (i % 3) * 6);
      boat.heading = Math.PI / 2;
      scene.add(boat.root);
      return { boat, name: `Bateau ${f.label}`, accent: f.accent, slot, phase: 'pre', tackCd: 0, margin: 0.05 + Math.random() * 0.25, lane: 45 + Math.random() * 30, finished: null };
    });
  }

  get countdownLeft() { return this.state === 'countdown' ? this.timer : 0; }

  // Le joueur s'inscrit : si aucune course n'est lancée, le compte à rebours de 30 s démarre.
  join(player) {
    if (this.state === 'racing') return false;
    this.player = { boat: player, name: 'Toi', phase: 'pre', finished: null, ocs: false, human: true };
    this.playerIn = true;
    if (this.state !== 'countdown') this.startCountdown();
    this.events.push({ kind: 'info', text: `Inscrit ! Départ dans ${Math.ceil(this.timer)} s : passe la ligne vers le nord après le signal.` });
    return true;
  }

  startCountdown() {
    this.state = 'countdown';
    this.timer = COUNTDOWN;
    this.results = [];
    for (const a of this.ai) { a.phase = 'pre'; a.finished = null; a.tackCd = 0; a.tack = -1; }
  }

  competitors() { return this.player && this.playerIn ? [...this.ai, this.player] : this.ai; }

  update(dt, playerBoat) {
    this.clock += dt;
    const { line, mark, axis } = COURSE;
    if (this.state === 'idle') {
      this.timer -= dt;
      if (this.timer <= 0) this.startCountdown();
    } else if (this.state === 'countdown') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'racing';
        this.clock = 0;
        this.committee.userData.flag.visible = false;
        this.events.push({ kind: 'start', text: 'Départ !' });
        if (this.player) {
          this.player.phase = 'pre';
          if (playerBoat.pos.y < line.z && playerBoat.pos.x > line.x0 && playerBoat.pos.x < line.x1) {
            this.player.ocs = true;
            this.events.push({ kind: 'warn', text: 'Départ anticipé ! Repasse sous la ligne puis repars.' });
          }
        }
      }
    } else if (this.state === 'racing') {
      const all = this.competitors();
      if (all.every((c) => c.finished !== null) || this.clock > 150) {
        this.state = 'results';
        this.timer = 10;
        this.events.push({ kind: 'results', text: '' });
      }
    } else if (this.state === 'results') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'idle';
        this.timer = 45;
        this.playerIn = false;
        this.player = null;
        this.committee.userData.flag.visible = true;
      }
    }

    // Pilotage des bateaux IA.
    const others = this.competitors();
    for (const a of this.ai) {
      const b = a.boat;
      let want = b.heading, power = 1;
      if (this.state !== 'racing' || a.phase === 'pre') {
        const go = this.state === 'countdown' && this.timer < 4.2;
        if (this.state === 'racing' || go) {
          want = -CLOSE_HAULED; // départ tribord amure, plein pot vers la ligne
          if (this.state === 'racing' && b.pos.y < line.z) { a.phase = 'beat'; a.tackCd = 2; a.tack = -1; }
        } else {
          // Attente sous la ligne, à sa place : on tourne doucement autour de son point.
          const hx = a.slot, hz = line.z + 24;
          const dx = hx - b.pos.x, dz = hz - b.pos.y, d = Math.hypot(dx, dz);
          want = d > 8 ? Math.atan2(dx, dz) : b.heading + 0.9;
          power = d > 8 ? 0.45 : 0.18;
        }
      } else if (a.phase === 'beat') {
        a.tackCd -= dt;
        const bear = Math.atan2(mark.x - b.pos.x, mark.z - b.pos.y);
        // Amure visée mémorisée : le virement va au bout même si le bateau met du temps à passer le lit du vent.
        const portTack = a.tack > 0; // bâbord amure = cap au nord-est
        const fetch = portTack ? bear > -(CLOSE_HAULED + a.margin) && bear < 0 : bear < CLOSE_HAULED + a.margin && bear > 0;
        const outOfLane = portTack ? b.pos.x - axis > a.lane : axis - b.pos.x > a.lane;
        if (a.tackCd <= 0 && (fetch || outOfLane)) {
          a.tack = -a.tack;
          a.tackCd = 5;
        }
        want = a.tack * CLOSE_HAULED;
        // Sur la lay-line : on vise directement la bouée dès qu'elle est atteignable sans virer.
        if ((a.tack > 0 && bear > 0 && bear <= CLOSE_HAULED) || (a.tack < 0 && bear < 0 && bear >= -CLOSE_HAULED)) want = bear;
        // Bouée contournée (ou dépassée au vent) : on part au portant.
        if (Math.hypot(mark.x - b.pos.x, mark.z - b.pos.y) < 18 || b.pos.y < mark.z - 6) a.phase = 'run';
      } else if (a.phase === 'run') {
        want = Math.atan2((line.x0 + line.x1) / 2 + (a.slot - axis) * 0.5 - b.pos.x, line.z + 4 - b.pos.y);
        if (b.pos.y > line.z && b.pos.x > line.x0 && b.pos.x < line.x1) this.finish(a);
      } else {
        const dx = a.slot - b.pos.x, dz = line.z + 45 - b.pos.y;
        want = Math.atan2(dx, dz);
        power = Math.hypot(dx, dz) > 10 ? 0.35 : 0.12;
      }

      // Règles de priorité : si une collision se profile et que je suis le bateau qui doit s'écarter, je m'écarte.
      let steerBias = 0;
      for (const o of others) {
        if (o === a) continue;
        const ob = o.boat;
        const rx = ob.pos.x - b.pos.x, rz = ob.pos.y - b.pos.y, d = Math.hypot(rx, rz);
        if (d > 30) continue;
        const fa = b.forward.multiplyScalar(b.speed), fo = ob.forward.multiplyScalar(ob.speed);
        const fx = rx + (fo.x - fa.x) * 1.6, fz = rz + (fo.y - fa.y) * 1.6;
        if (Math.hypot(fx, fz) > 13 && d > 11) continue;
        if (this.mustGiveWay(b, ob)) {
          const side = Math.sign(Math.sin(Math.atan2(rx, rz) - b.heading)) || 1;
          steerBias -= side * 1.4; // s'écarter du côté opposé à l'autre bateau
          // Message une seule fois par manœuvre, et seulement en course.
          if (d < 14 && o.human && this.state === 'racing' && this.clock - (a.lastYield || -99) > 8) {
            a.lastYield = this.clock;
            this.events.push({ kind: 'rule', text: `${a.name} s’écarte : tu avais la priorité.` });
          }
        }
      }

      const input = {
        steer: THREE.MathUtils.clamp(wrap(want - b.heading) * 2 + steerBias, -1, 1),
        power,
        brake: false,
      };
      b.update(dt, input, this.world.collide);
    }

    // Contacts entre bateaux : on les sépare, et le fautif (s'il s'agit du joueur) est pénalisé.
    const fleet = others.map((c) => c.boat);
    for (let i = 0; i < fleet.length; i++) {
      for (let j = i + 1; j < fleet.length; j++) {
        const p = fleet[i], q = fleet[j];
        const dx = q.pos.x - p.pos.x, dz = q.pos.y - p.pos.y, d = Math.hypot(dx, dz);
        if (d < 8 && d > 1e-3) {
          const push = (8 - d) / 2;
          p.pos.x -= (dx / d) * push; p.pos.y -= (dz / d) * push;
          q.pos.x += (dx / d) * push; q.pos.y += (dz / d) * push;
          const human = others.find((c) => c.human && (c.boat === p || c.boat === q));
          if (human && this.state === 'racing' && (this.clock - (this.lastFoul || -9) > 4)) {
            this.lastFoul = this.clock;
            const other = human.boat === p ? q : p;
            if (this.mustGiveWay(human.boat, other)) {
              human.boat.speed *= 0.3;
              this.events.push({ kind: 'warn', text: this.ruleText(human.boat, other) });
            } else {
              other.speed *= 0.3;
              this.events.push({ kind: 'rule', text: 'L’autre bateau devait s’écarter : pénalité pour lui.' });
            }
          }
        }
      }
    }

    // Progression du joueur.
    if (this.player && this.state === 'racing' && this.player.finished === null) {
      const pl = this.player, b = playerBoat;
      const inLine = b.pos.x > line.x0 && b.pos.x < line.x1;
      if (pl.ocs) {
        if (b.pos.y > line.z + 2) { pl.ocs = false; this.events.push({ kind: 'info', text: 'Bien, tu peux repartir.' }); }
      } else if (pl.phase === 'pre' && b.pos.y < line.z && inLine) {
        pl.phase = 'beat';
        this.events.push({ kind: 'info', text: 'Parti ! Monte au près jusqu’à la bouée jaune au nord.' });
      } else if (pl.phase === 'beat' && Math.hypot(mark.x - b.pos.x, mark.z - b.pos.y) < 18) {
        pl.phase = 'run';
        this.events.push({ kind: 'info', text: 'Bouée passée ! Redescends finir sur la ligne.' });
      } else if (pl.phase === 'run' && b.pos.y > line.z && inLine) {
        this.finish(pl);
      }
    }
  }

  finish(c) {
    if (c.finished !== null) return;
    c.finished = this.clock;
    this.results.push(c);
    c.phase = 'done';
    if (c.human) this.events.push({ kind: 'start', text: `Arrivée ! ${this.results.length}${this.results.length === 1 ? 'er' : 'e'} sur ${this.competitors().length}.` });
  }

  // Qui doit s'écarter ? (règles simplifiées : amures, au vent / sous le vent, route libre derrière)
  mustGiveWay(me, other) {
    if (me.side !== other.side) return me.side > 0; // bâbord amure (side > 0) s'écarte de tribord amure
    const rx = other.pos.x - me.pos.x, rz = other.pos.y - me.pos.y;
    const fwd = me.forward;
    const along = rx * fwd.x + rz * fwd.y;
    const overlapped = Math.abs(along) < 11;
    if (overlapped) return me.pos.y < other.pos.y; // le plus au nord (au vent) s'écarte
    return along > 0; // l'autre est devant : je suis en route libre derrière, je m'écarte
  }

  ruleText(me, other) {
    if (me.side !== other.side) return 'Bâbord amure : tu devais t’écarter du bateau tribord amure. Pénalité !';
    const rx = other.pos.x - me.pos.x, rz = other.pos.y - me.pos.y, fwd = me.forward;
    if (Math.abs(rx * fwd.x + rz * fwd.y) < 11) return 'Au vent : tu devais t’écarter du bateau sous le vent. Pénalité !';
    return 'Route libre derrière : tu devais t’écarter du bateau devant. Pénalité !';
  }

  // Classement en cours (arrivés, puis progression sur le parcours).
  standings(playerBoat) {
    const { line, mark } = COURSE;
    const score = (c) => {
      const b = c.human ? playerBoat : c.boat;
      if (c.finished !== null) return 1e6 - c.finished;
      if (c.phase === 'run') return 2000 - Math.abs(line.z - b.pos.y);
      if (c.phase === 'beat') return 1000 - Math.hypot(mark.x - b.pos.x, mark.z - b.pos.y);
      return 0;
    };
    return [...this.competitors()].sort((p, q) => score(q) - score(p));
  }
}
