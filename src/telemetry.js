import * as THREE from 'three';

// --- Flux de données bateau → phare : des paquets lumineux qui volent le long d'un arc.
export class DataStream {
  constructor(count = 20) {
    this.count = count;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), new THREE.MeshBasicMaterial({ color: '#00d4ff' }), count);
    this.mesh.frustumCulled = false;
    this.phase = Array.from({ length: count }, (_, i) => i / count);
    this.curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
    this.level = 0;
  }
  update(dt, t, from, to, strength) {
    this.level = THREE.MathUtils.damp(this.level, strength, 3, dt);
    const c = this.curve;
    c.v0.copy(from);
    c.v2.copy(to);
    c.v1.set((from.x + to.x) / 2, Math.max(from.y, to.y) + from.distanceTo(to) * 0.25, (from.z + to.z) / 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < this.count; i++) {
      const u = (this.phase[i] + t * 0.35) % 1;
      c.getPoint(u, p);
      const k = this.level * Math.sin(u * Math.PI);
      s.setScalar(Math.max(k, 0.0001) * (0.8 + (i % 3) * 0.25));
      q.setFromEuler(new THREE.Euler(t * 2 + i, t * 3 + i, 0));
      m.compose(p, q, s);
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = this.level > 0.01;
  }
}

// --- Enregistreur : la télémétrie du bateau, échantillonnée à 10 Hz sur une fenêtre glissante.
export const CHANNELS = [
  { key: 'bsp', name: 'Vitesse', unit: 'nds', col: 'bsp', fmt: (v) => v.toFixed(1), min: 0 },
  { key: 'twa', name: 'Angle au vent', unit: '°', col: 'twa', fmt: (v) => Math.round(v), min: 0, max: 180 },
  { key: 'foil', name: 'Hauteur de vol', unit: 'm', col: 'foil_h', fmt: (v) => v.toFixed(2), min: 0 },
  { key: 'hdg', name: 'Cap', unit: '°', col: 'hdg', fmt: (v) => Math.round(v), min: 0, max: 360 },
];
const HZ = 10, WINDOW = 60, BUCKET = 5;

export class Recorder {
  constructor() {
    this.rows = [];
    this.total = 0;
    this.acc = 0;
  }
  sample(dt, t, boat) {
    this.acc += dt;
    while (this.acc >= 1 / HZ) {
      this.acc -= 1 / HZ;
      const hdg = ((Math.PI - boat.heading) * 180 / Math.PI + 360) % 360; // cap compas : 0 = nord
      this.rows.push({ t, bsp: boat.speed * 1.944, twa: boat.twa * 180 / Math.PI, foil: Math.max(boat.height, 0), hdg });
      this.total++;
    }
    const from = t - WINDOW;
    while (this.rows.length && this.rows[0].t < from) this.rows.shift();
  }
  // Équivalent Flux de « aggregateWindow(every: 5s, fn: mean) ».
  buckets(key, now) {
    const out = new Map();
    for (const r of this.rows) {
      const b = Math.floor(r.t / BUCKET) * BUCKET;
      const o = out.get(b) || { t: b, sum: 0, n: 0 };
      o.sum += r[key]; o.n++;
      out.set(b, o);
    }
    return [...out.values()].map((o) => ({ t: o.t, v: o.sum / o.n }));
  }
}

// --- Panneau : 4 petits graphes (un par grandeur, chacun sa propre échelle), brut 10 Hz + moyenne 5 s.
const RAW = '#3987e5', AGG = '#d95926';

export class TelemetryPanel {
  constructor(el, recorder) {
    this.el = el;
    this.rec = recorder;
    this.hover = null;
    el.innerHTML = `
      <header>
        <div class="tm-tag">Télémétrie → base</div>
        <div class="tm-rate"><b class="tm-total">0</b> points · <span>10 Hz</span></div>
      </header>
      <div class="tm-legend"><span><i style="background:${RAW}"></i>brut · 10 Hz</span><span><i class="agg" style="background:${AGG}"></i>moyenne · 5 s</span></div>
      <div class="tm-charts">${CHANNELS.map((c) => `
        <figure class="tm-chart" data-key="${c.key}">
          <figcaption><span>${c.name}</span><b class="tm-now">–</b><small>${c.unit}</small></figcaption>
          <canvas width="520" height="120"></canvas>
          <div class="tm-tip" hidden></div>
        </figure>`).join('')}</div>
      <pre class="tm-line"></pre>
      <pre class="tm-sql"></pre>`;
    this.charts = CHANNELS.map((c) => {
      const fig = el.querySelector(`[data-key="${c.key}"]`);
      const canvas = fig.querySelector('canvas');
      canvas.addEventListener('pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        this.hover = { key: c.key, x: (e.clientX - r.left) / r.width };
      });
      canvas.addEventListener('pointerleave', () => { this.hover = null; });
      return { c, fig, canvas, now: fig.querySelector('.tm-now'), tip: fig.querySelector('.tm-tip') };
    });
  }

  render(now) {
    const rows = this.rec.rows;
    this.el.querySelector('.tm-total').textContent = this.rec.total.toLocaleString('fr-FR');
    const t0 = now - WINDOW;
    for (const ch of this.charts) {
      const { c, canvas } = ch;
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height, padL = 6, padR = 6, padT = 10, padB = 10;
      ctx.clearRect(0, 0, W, H);
      if (!rows.length) continue;
      const vals = rows.map((r) => r[c.key]);
      let lo = c.min ?? Math.min(...vals), hi = c.max ?? Math.max(...vals);
      if (c.max === undefined) hi = Math.max(hi, lo + (c.key === 'foil' ? 2 : 5));
      const X = (t) => padL + ((t - t0) / WINDOW) * (W - padL - padR);
      const Y = (v) => H - padB - ((v - lo) / (hi - lo || 1)) * (H - padT - padB);
      // Grille discrète.
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let k = 0; k <= 2; k++) { const y = padT + (k * (H - padT - padB)) / 2; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke(); }
      // Brut : trait fin.
      ctx.strokeStyle = RAW;
      ctx.lineWidth = 2;
      ctx.beginPath();
      rows.forEach((r, i) => (i ? ctx.lineTo(X(r.t), Y(r[c.key])) : ctx.moveTo(X(r.t), Y(r[c.key]))));
      ctx.stroke();
      // Agrégé : marches de 5 s.
      const b = this.rec.buckets(c.key, now);
      ctx.strokeStyle = AGG;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      b.forEach((o, i) => {
        const xa = X(Math.max(o.t, t0)), xb = X(Math.min(o.t + BUCKET, now)), y = Y(o.v);
        if (i) ctx.lineTo(xa, y); else ctx.moveTo(xa, y);
        ctx.lineTo(xb, y);
      });
      ctx.stroke();
      ch.now.textContent = c.fmt(vals[vals.length - 1]);

      // Survol : réticule + valeurs brute et moyenne à cet instant.
      if (this.hover?.key === c.key) {
        const t = t0 + this.hover.x * WINDOW;
        let best = rows[0];
        for (const r of rows) if (Math.abs(r.t - t) < Math.abs(best.t - t)) best = r;
        const xh = X(best.t);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(xh, padT - 4); ctx.lineTo(xh, H - padB + 4); ctx.stroke();
        ctx.fillStyle = RAW;
        ctx.beginPath(); ctx.arc(xh, Y(best[c.key]), 6, 0, 7); ctx.fill();
        ctx.strokeStyle = '#0a1422'; ctx.lineWidth = 2; ctx.stroke();
        const bk = b.find((o) => best.t >= o.t && best.t < o.t + BUCKET);
        ch.tip.hidden = false;
        ch.tip.style.left = `${(xh / W) * 100}%`;
        ch.tip.innerHTML = `<b>${c.fmt(best[c.key])} ${c.unit}</b> brut · ${bk ? c.fmt(bk.v) : '–'} moy. · il y a ${Math.round(now - best.t)} s`;
      } else ch.tip.hidden = true;
    }
    // Écriture : le dernier point en line protocol, tel qu'il part vers InfluxDB.
    const last = rows[rows.length - 1];
    if (last) {
      const ns = BigInt(Math.round((Date.now() - (now - last.t) * 1000))) * 1000000n;
      this.el.querySelector('.tm-line').textContent =
        `boat,id=BP bsp=${last.bsp.toFixed(2)},twa=${last.twa.toFixed(1)},foil_h=${last.foil.toFixed(2)},hdg=${last.hdg.toFixed(1)} ${ns}`;
    }
    // Lecture : la requête Flux qui produit les marches orange.
    this.el.querySelector('.tm-sql').textContent =
`from(bucket: "telemetry")
  |> range(start: -60s)
  |> filter(fn: (r) => r._measurement == "boat" and r.id == "BP")
  |> filter(fn: (r) => r._field == "bsp" or r._field == "foil_h")
  |> aggregateWindow(every: 5s, fn: mean, createEmpty: false)
// ${this.rec.buckets('bsp', now).length} fenêtres par champ`;
  }
}
