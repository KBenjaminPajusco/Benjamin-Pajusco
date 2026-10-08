// Contenu du CV : la seule source de vérité, utilisée par le monde 3D et par la version rapide.

export const PROFILE = {
  name: 'Benjamin Pajusco',
  title: 'Ingénieur Performance & IA',
  tagline: 'Voile · data · simulation · agents IA',
  links: [
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/benjamin-pajusco-075b9b1b9/' },
    { label: 'Email', href: 'mailto:benjamin.pajusco@gmail.com' },
  ],
};

// Ordre chronologique : c'est l'ordre des bouées du chenal.
// brand : monogramme + couleur affichés sur la bouée et la fiche. Pour un vrai logo,
// ajouter logo: 'assets/logos/<id>.png' (carré, fond transparent) : il remplace le monogramme.
export const EXPERIENCES = [
  {
    id: 'naval',
    brand: { mono: 'NG', color: '#0b2d5b' },
    logo: 'assets/logos/naval.svg',
    geo: { lat: 48.39, lon: -4.49 },
    year: '2022',
    org: 'Naval Group',
    role: 'Stage — éléments de soutien',
    dates: 'juil. 2022 · 1 mois',
    place: 'Brest',
    flag: 'FR',
    kind: 'stage',
    body: 'Premier pied dans l’industrie navale : outils internes en Excel VBA.',
    tags: ['Excel VBA'],
  },
  {
    id: 'apcc',
    brand: { mono: 'APCC', color: '#26a3dd' },
    logo: 'assets/logos/apcc.png',
    geo: { lat: 47.26, lon: -2.34 },
    year: '2024',
    org: 'APCC Voile Sportive',
    role: 'Stage — maintenance des bateaux & gestion des données',
    dates: 'juin → août 2024 · 3 mois',
    place: 'Pornichet',
    flag: 'FR',
    kind: 'stage',
    body: 'Entre le chantier et le code : maintenance de la flotte et outils de gestion des données.',
    tags: ['Node.js', 'Maintenance', 'Réparation'],
  },
  {
    id: 'shn',
    brand: { mono: 'SHN', color: '#2b4fbf' },
    geo: { lat: 47.22, lon: -1.55 },
    year: '', // pas de dates affichées pour le haut niveau
    org: 'Sportif de haut niveau',
    role: 'Voile inshore — Match Racing',
    dates: '',
    place: 'Nantes',
    flag: 'FR',
    kind: 'sport',
    body: 'Sportif de haut niveau International en voile inshore, discipline match racing, en parallèle des études d’ingénieur.',
    tags: ['Match Racing', 'Voile inshore', 'Haut niveau International'],
  },
  {
    id: 'segula',
    brand: { mono: 'S', color: '#1F4492' },
    logo: 'assets/logos/segula.svg',
    geo: { lat: 47.33, lon: -2.15 },
    year: '2025',
    org: 'SEGULA Technologies',
    role: 'Stage — analyse de documents, OCR & extraction de données',
    dates: 'juin → oct. 2025 · 5 mois',
    place: 'Montoir-de-Bretagne',
    flag: 'FR',
    kind: 'stage',
    body: 'Analyse de documents PDF, extraction de données et automatisation des processus par IA.',
    tags: ['OCR', 'Extraction', 'Automatisation IA'],
  },
  {
    id: 'maliora',
    brand: { mono: 'M', color: '#151515', ink: '#f5e02a' },
    year: '2025–26',
    org: 'Maliora',
    role: 'CEO & co-fondateur',
    dates: 'oct. 2025 → juin 2026 · 9 mois',
    place: 'France',
    flag: 'FR',
    kind: 'job',
    body: 'Co-fondation et direction d’une startup : une application pour accompagner le coaching sportif en ligne.',
    tags: ['Entrepreneuriat', 'Application', 'Coaching sportif'],
  },
  {
    id: 'kc-stage',
    brand: { mono: 'KC', color: '#14275b', round: true },
    logo: 'assets/logos/kc.png',
    geo: { lat: 47.75, lon: -3.37 },
    year: '2026',
    org: 'K-Challenge Racing & Lab',
    role: 'Stage de 6 mois — Développeur logiciel & architecture performance',
    dates: 'févr. → juil. 2026',
    place: 'Lorient',
    flag: 'FR',
    kind: 'stage',
    body: 'Architecture des outils de performance d’une équipe de Coupe de l’America.',
    tags: ['Architecture', 'Performance'],
  },
  {
    id: 'kc',
    brand: { mono: 'KC', color: '#14275b', round: true },
    logo: 'assets/logos/kc.png',
    geo: { lat: 40.85, lon: 14.27 },
    year: '2026 →',
    org: 'K-Challenge Racing & Lab',
    role: 'CDI projet — Ingénieur Performance & IA, Coupe de l’America',
    dates: 'depuis sept. 2026',
    place: 'Naples',
    flag: 'IT',
    kind: 'job',
    body: 'Pour la Coupe de l’America : infrastructure logicielle et conception des outils de performance de l’équipe, avec l’IA au cœur de la méthode.',
    tags: ['Coupe de l’America', 'Infrastructure logicielle', 'Conception logicielle', 'IA'],
  },
];

// Une école = un bâtiment sur l'île Formation.
export const EDUCATION = [
  { id: 'polytech', school: 'Polytech Nantes', degree: 'Diplôme d’ingénieur — Informatique', dates: '2021 → 2026',
    body: 'Prépa intégrée (PeiP) puis cycle ingénieur. Web, Java, C, Python, R. BDE, compétition universitaire, délégué de la spécialité informatique.',
    tags: ['Ingénieur', 'Informatique'], place: 'Nantes', flag: 'FR', brand: { mono: 'P', color: '#2f80c3' }, logo: 'assets/logos/polytech.webp',
    geo: { lat: 47.22, lon: -1.55 } },
  { id: 'ronarch', school: 'Lycée Amiral Ronarc’h', degree: 'Bac général — Maths & Physique', dates: '2019 → 2021',
    body: 'Conseil de vie lycéenne, conseil d’administration, conseil de discipline.',
    tags: ['Maths', 'Physique'], place: 'Brest', flag: 'FR', brand: { mono: 'AR', color: '#1d3557' },
    geo: { lat: 48.39, lon: -4.49 } },
  { id: 'guelph', school: 'Guelph Collegiate Vocational Institute', degree: 'Grade 10 — Ontario, Canada', dates: '2018 → 2019',
    body: 'Une année de scolarité en anglais au Canada.',
    tags: ['Anglais', 'International'], place: 'Guelph, Ontario', flag: 'CA', brand: { mono: 'GC', color: '#7a1f2b' }, logo: 'assets/logos/guelph.png',
    geo: { lat: 43.55, lon: -80.25 } },
];

export const PLACES = [
  { name: 'Brest', flag: 'FR' }, { name: 'Nantes', flag: 'FR' }, { name: 'Pornichet', flag: 'FR' },
  { name: 'Lorient', flag: 'FR' }, { name: 'Naples', flag: 'IT' }, { name: 'Guelph, Ontario', flag: 'CA' },
];

export const LANGUAGES = [
  { name: 'Français', level: 'Langue maternelle' },
  { name: 'Anglais', level: 'Courant à l’oral · TOEIC' },
];

export const INTERESTS = {
  run: {
    kicker: 'Centre d’intérêt',
    title: 'Course à pied',
    body: 'Trail de la digue (54 km), marathon et semi-marathon.',
    tags: ['Running'],
  },
  gym: {
    kicker: 'Centre d’intérêt',
    title: 'Musculation',
    body: 'Pratique de la musculation en salle et en extérieur, ainsi que la gymnastique.',
    tags: ['Musculation'],
  },
  code: {
    kicker: 'Centre d’intérêt',
    title: 'Code',
    body: 'Algorithmes et katas pour le plaisir : 4 kyu sur Codewars. Participations à la Battle Dev Thales et à la Match Up Coding Battle.',
    tags: ['Codewars 4 kyu', 'Battle Dev', 'Python'],
  },
  mod: {
    kicker: 'Centre d’intérêt',
    title: 'Modding & rétro-ingénierie',
    body: 'Modding et rétro-ingénierie de jeux vidéo, notamment Trackmania : créer des modes de jeu inédits.',
    tags: ['Trackmania', 'Modding', 'Rétro-ingénierie'],
  },
  climb: {
    kicker: 'Centre d’intérêt',
    title: 'Escalade',
    body: 'Escalade en loisir, niveau intermédiaire : du bloc et des voies, pour le plaisir de grimper.',
    tags: ['Bloc', 'Loisir'],
  },
};

// --- Le Phare des maîtrises : ce que je sais faire, et où je l'ai fait.
// La donnée est le fil rouge ; l'IA est ce qui me permet de réaliser vite.
export const CONCEPTS = [
  { id: 'rel', name: 'Modélisation relationnelle', hint: 'schémas, relations, contraintes, évolution du modèle — PostgreSQL' },
  { id: 'ts', name: 'Séries temporelles', hint: 'télémétrie haute fréquence, stockage et requêtes par fenêtre — InfluxDB' },
  { id: 'agg', name: 'Agrégation & requêtes ciblées', hint: 'ne renvoyer que la résolution utile à l’écran' },
  { id: 'cache', name: 'Cache', hint: 'côté navigateur et côté serveur : ne jamais recalculer deux fois' },
  { id: 'api', name: 'Échanges front ↔ back', hint: 'API, flux compressés, une interface qui reste fluide' },
  { id: 'ctx', name: 'Maîtrise du contexte IA', hint: 'agents, instructions, mémoire : réaliser vite et juste' },
  { id: 'design', name: 'Conception', hint: 'partir d’un besoin flou et en faire un outil adopté' },
];

export const WORKS = [
  { id: 'workbench', name: 'Outil d’analyse de performance', where: 'équipe de Coupe de l’America',
    concepts: ['rel', 'ts', 'agg', 'cache', 'api', 'design'],
    me: 'L’architecture, le modèle de données, le chemin de la donnée de bout en bout.',
    ai: 'L’implémentation des composants, des routes et des tests, sous ma relecture.' },
  { id: 'pipeline', name: 'Pipeline de données de navigation', where: 'de la session en mer jusqu’aux bases',
    concepts: ['rel', 'ts', 'agg'],
    me: 'Le découpage des étapes et le schéma des bases (relationnel + séries temporelles).',
    ai: 'Les scripts d’ingestion et leur durcissement.' },
  { id: 'autofix', name: 'Boucle d’autofix & équipe d’agents', where: 'open space des agents', zone: 'agents',
    concepts: ['ctx', 'design', 'api'],
    me: 'Le processus, les garde-fous, la décision finale.',
    ai: 'L’évaluation, la correction et la vérification de chaque issue.' },
  { id: 'portfolio', name: 'Ce portfolio', where: 'tu es dedans', zone: 'phare',
    concepts: ['cache', 'agg', 'ctx', 'design'],
    me: 'Le concept, la direction artistique, chaque choix.',
    ai: 'Le code du monde 3D, construit en dialogue avec un agent.' },
];

// Plans d'eau où j'ai régaté (depuis mes favoris Windy, 2026-10-07).
export const REGATTAS = [
  ['Pornichet', 47.254, -2.349], ['La Trinité-sur-Mer', 47.555, -3.047], ['Kerzo, Lorient', 47.719, -3.357],
  ['Saint-Quay-Portrieux', 48.668, -2.816], ['Côte d’Émeraude', 48.638, -2.233], ['Tourlaville', 49.678, -1.592],
  ['Carquefou', 47.307, -1.53], ['Rivedoux-Plage', 46.095, -1.222], ['Saint-Tropez', 43.282, 6.704],
  ['Antibes', 43.563, 7.164], ['Quarteira', 37.061, -8.122], ['Palma de Majorque', 39.57, 2.65],
  ['Lac de Ledro', 45.876, 10.735], ['Naples', 40.818, 14.253], ['Tivat', 42.426, 18.677],
  ['Lac d’Ohrid', 41.1, 20.788], ['Pancharevo', 42.448, 23.617], ['Szczecin', 53.412, 14.65],
  ['Sopot', 54.442, 18.692], ['Bülk, Kiel', 54.447, 10.237], ['Haven', 53.998, 10.911],
  ['Göteborg', 57.707, 11.967], ['Helsinki', 60.143, 24.943], ['Macao', 22.174, 113.559],
].map(([name, lat, lon]) => ({ name, lat, lon }));

// L'open space des agents : un exemple concret de flux IA (pas un centre d'intérêt).
export const AI_FLOW = {
    kicker: 'Exemple de flux IA',
    title: 'L’open space des agents',
    body: 'Ma boucle d’autofix : un utilisateur signale un bug, des agents Claude l’évaluent, le corrigent et le vérifient, puis je relis et je décide. Suis le ticket de station en station.',
    tags: ['Agents Claude', 'GitHub', 'Autofix', 'Playwright'],
  };

// Technologies maîtrisées, par famille (fiche du Phare et carte).
export const SKILLS = [
  { group: 'Données', items: ['PostgreSQL', 'InfluxDB · Flux', 'SQLite'] },
  { group: 'Back-end', items: ['Python', 'FastAPI', 'NumPy', 'Node.js'] },
  { group: 'Front-end', items: ['React', 'Zustand', 'Plotly', 'Three.js', 'Vite'] },
  { group: 'Infra', items: ['Docker', 'nginx', 'pm2', 'Linux', 'Git · GitHub'] },
  { group: 'IA', items: ['Claude Code', 'Agents & MCP', 'Playwright'] },
];
