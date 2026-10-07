// Mini-carte de géolocalisation : contour des terres, frontières, pays surligné, pin et drapeau.
// Données Natural Earth (world-atlas) + d3-geo, chargées à la demande depuis jsDelivr.

let libs = null;
function load() {
  libs ??= Promise.all([
    import('https://cdn.jsdelivr.net/npm/d3-geo@3/+esm'),
    import('https://cdn.jsdelivr.net/npm/topojson-client@3/+esm'),
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json').then((r) => r.json()),
  ]).then(([d3, topo, world]) => ({
    d3,
    countries: topo.feature(world, world.objects.countries).features,
    borders: topo.mesh(world, world.objects.countries, (a, b) => a !== b),
    land: topo.feature(world, world.objects.land),
  }));
  return libs;
}

const FLAGS = {
  FR: ['#2b4fbf', '#ffffff', '#e8404a'],
  IT: ['#2f9e55', '#ffffff', '#e8404a'],
  CA: ['#e8404a', '#ffffff', '#e8404a'],
};
function flagSvg(code, x, y) {
  const c = FLAGS[code];
  if (!c) return '';
  const w = 9, h = 13;
  const maple = code === 'CA' ? `<rect x="${x + w + 2}" y="${y + 3}" width="${w - 4}" height="${h - 6}" fill="#e8404a"/>` : '';
  return `<g class="flag"><line x1="${x}" y1="${y}" x2="${x}" y2="${y + 26}" stroke="#1d2533" stroke-width="1.6"/>
    ${c.map((col, i) => `<rect x="${x + i * w}" y="${y}" width="${w}" height="${h}" fill="${col}"/>`).join('')}
    ${maple}<rect x="${x}" y="${y}" width="${w * 3}" height="${h}" fill="none" stroke="#1d2533" stroke-width="1.2"/></g>`;
}

// Carte des plans d'eau : un pin par régate, cadrée sur l'Europe ; les lieux lointains sont cités à part.
export async function renderRegattaMap(svg, spots) {
  const W = 280, H = 200;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const { d3, borders, land } = await load();
  const near = spots.filter((s) => s.lon > -30 && s.lon < 45);
  const frame = { type: 'MultiPoint', coordinates: near.map((s) => [s.lon, s.lat]) };
  const proj = d3.geoMercator().fitExtent([[16, 14], [W - 16, H - 10]], frame);
  const path = d3.geoPath(proj);
  const pins = near.map((s) => {
    const [x, y] = proj([s.lon, s.lat]);
    return `<circle class="rpin" cx="${x}" cy="${y}" r="3.6"><title>${s.name}</title></circle>`;
  }).join('');
  svg.innerHTML = `
    <defs><clipPath id="geo-clip-r"><rect width="${W}" height="${H}" rx="10"/></clipPath></defs>
    <g clip-path="url(#geo-clip-r)">
      <rect class="sea" width="${W}" height="${H}"/>
      <path class="land" d="${path(land)}"/>
      <path class="borders" d="${path(borders)}"/>
      ${pins}
    </g>`;
  return spots.filter((s) => !near.includes(s)).map((s) => s.name);
}

// Dessine la carte dans `svg` ; `prev` (lieu précédent) ajoute l'arc du trajet s'il reste lisible.
export async function renderGeoMap(svg, geo, prev) {
  const W = 280, H = 180;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const { d3, countries, borders, land } = await load();
  const pts = [[geo.lon, geo.lat]];
  const showArc = prev && prev.place !== geo.place && Math.abs(prev.lon - geo.lon) < 110;
  if (showArc) pts.push([prev.lon, prev.lat]);
  const lons = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
  const padLon = Math.max((Math.max(...lons) - Math.min(...lons)) * 0.3, 9);
  const padLat = Math.max((Math.max(...lats) - Math.min(...lats)) * 0.3, 6);
  const frame = { type: 'MultiPoint', coordinates: [[Math.min(...lons) - padLon, Math.min(...lats) - padLat], [Math.max(...lons) + padLon, Math.max(...lats) + padLat]] };
  const proj = d3.geoMercator().fitExtent([[8, 8], [W - 8, H - 8]], frame);
  const path = d3.geoPath(proj);
  const home = countries.find((c) => d3.geoContains(c, [geo.lon, geo.lat]));
  const [px, py] = proj([geo.lon, geo.lat]);
  const arc = showArc ? `<path class="arc" d="${path({ type: 'LineString', coordinates: [[prev.lon, prev.lat], [geo.lon, geo.lat]] })}"/>
    <circle class="from" cx="${proj([prev.lon, prev.lat])[0]}" cy="${proj([prev.lon, prev.lat])[1]}" r="3"/>` : '';
  svg.innerHTML = `
    <defs><clipPath id="geo-clip"><rect width="${W}" height="${H}" rx="10"/></clipPath></defs>
    <g clip-path="url(#geo-clip)">
      <rect class="sea" width="${W}" height="${H}"/>
      <path class="land" d="${path(land)}"/>
      ${home ? `<path class="home" d="${path(home)}"/>` : ''}
      <path class="borders" d="${path(borders)}"/>
      ${arc}
      <g class="pin" transform="translate(${px} ${py})">
        <circle class="pulse" r="5"/>
        <path d="M0 0 C -7 -9 -7 -18 0 -18 C 7 -18 7 -9 0 0 Z"/>
        <circle cy="-12.5" r="2.6" fill="#fff"/>
      </g>
      ${flagSvg(geo.flag, Math.min(px + 9, W - 36), Math.max(py - 34, 6))}
    </g>`;
}
