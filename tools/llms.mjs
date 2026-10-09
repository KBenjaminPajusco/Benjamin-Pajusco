// Génère /llms.txt et /cv.md depuis src/cv.js : la version texte du site, pour les agents et
// les moteurs qui ne voient pas le monde 3D. Aucune consigne aux agents, seulement des faits.
//
// Usage : node tools/llms.mjs   (lancé aussi par tools/version.py avant chaque publication)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PROFILE, EXPERIENCES, EDUCATION, LANGUAGES, INTERESTS, CONCEPTS, WORKS, REGATTAS, AI_FLOW, SKILLS } from '../src/cv.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = 'https://benjamin.pajusco.fr';
const email = PROFILE.links.find((l) => l.label === 'Email').href.replace('mailto:', '');
const linkedin = PROFILE.links.find((l) => l.label === 'LinkedIn').href;
const ABOUT = `Le site est un portfolio 3D interactif : on choisit un foiler ou un semi-rigide, on navigue entre les bouées du parcours professionnel jusqu’à une île (formation, emploi, centres d’intérêt), on peut y débarquer à pied, visiter le Phare des compétences et courir une régate contre deux bateaux. Tout le monde 3D est procédural (Three.js, aucun modèle 3D importé) et se joue au clavier, à la souris ou au doigt. Une version rapide, en texte, est accessible depuis le bouton « Version rapide » / « CV classique ».`;

const llms = `# ${PROFILE.name}

> ${PROFILE.title} chez K-Challenge Racing & Lab (Coupe de l’America). ${PROFILE.tagline}. Diplômé ingénieur informatique de Polytech Nantes, sportif de haut niveau en voile (match racing).

${ABOUT}

## CV

- [CV complet en Markdown](${SITE}/cv.md) : expériences, formation, compétences, réalisations, langues, centres d’intérêt
- [Portfolio 3D](${SITE}/) : l’expérience interactive

## Contact

- Email : ${email}
- LinkedIn : ${linkedin}
`;

const tags = (t) => (t?.length ? `\n  *${t.join(' · ')}*` : '');
const lines = [];
lines.push(`# ${PROFILE.name} — ${PROFILE.title}`, '', `${PROFILE.tagline}`, '', `Email : ${email} · LinkedIn : ${linkedin} · Site : ${SITE}/`, '', `> ${ABOUT}`, '');
lines.push('## Expérience', '');
for (const e of [...EXPERIENCES].reverse()) {
  const when = [e.dates, e.place].filter(Boolean).join(' · ');
  lines.push(`- **${e.org}** — ${e.role}${when ? ` (${when})` : ''}  \n  ${e.body}${tags(e.tags)}`);
}
lines.push('', '## Formation', '');
for (const s of EDUCATION) lines.push(`- **${s.school}** — ${s.degree} (${s.dates}, ${s.place})  \n  ${s.body}`);
lines.push('', '## Compétences', '');
for (const g of SKILLS) lines.push(`- **${g.group}** : ${g.items.join(', ')}`);
lines.push('', '### Maîtrises', '');
for (const c of CONCEPTS) lines.push(`- **${c.name}** : ${c.hint}`);
lines.push('', '## Réalisations', '');
const low = (t) => t[0].toLowerCase() + t.slice(1);
const cname = Object.fromEntries(CONCEPTS.map((c) => [c.id, c.name]));
for (const w of WORKS) lines.push(`- **${w.name}** (${w.zone === 'phare' ? 'ce site' : w.where})  \n  Ma part : ${low(w.me)} Part de l’IA : ${low(w.ai)}\n  *${w.concepts.map((id) => cname[id]).join(' · ')}*`);
lines.push(`- **${AI_FLOW.title}** — ${AI_FLOW.body.replace(/ Suis le ticket.*$/, '')}${tags(AI_FLOW.tags)}`);
lines.push('', '## Langues', '');
for (const l of LANGUAGES) lines.push(`- ${l.name} : ${l.level}`);
lines.push('', '## Centres d’intérêt', '');
for (const i of Object.values(INTERESTS)) lines.push(`- **${i.title}** : ${i.body}`);
lines.push(`- **Voile** : régates sur ${REGATTAS.length} plans d’eau, dont ${REGATTAS.slice(0, 6).map((r) => r.name).join(', ')}, Naples, Helsinki, Macao…`);
lines.push('');

writeFileSync(ROOT + 'llms.txt', llms);
writeFileSync(ROOT + 'cv.md', lines.join('\n'));
console.log('llms.txt + cv.md');
