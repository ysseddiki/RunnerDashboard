/** Contenu pédagogique des types de séance (Docs + aide picker). */

export type SessionTypeDoc = {
  id: string
  label: string
  summary: string
  purpose: string
  feel: string
  typical: string
  zones: string
  tips: string
  /** Zones FC typiques (ids profil Z1–Z5) */
  zoneIds: string[]
}

export const SESSION_TYPE_DOCS: SessionTypeDoc[] = [
  {
    id: 'ef',
    label: 'EF — Endurance fondamentale',
    summary: 'Base aérobie, conversationnelle, zone basse.',
    purpose:
      'Développer l’endurance, digérer la charge, construire le volume sans trop de stress.',
    feel: 'Vous devez pouvoir parler en phrases. Respiration calme, jambes légères.',
    typical: '30–90 min, 1–3× / semaine selon volume. Souvent la majorité du km hebdo.',
    zones: 'Principalement Z1–Z2. Peu ou pas de Z4–Z5.',
    tips: 'Si la FC dérive trop (chaleur, dénivelé), ralentissez plutôt que de « forcer l’allure ».',
    zoneIds: ['Z1', 'Z2'],
  },
  {
    id: 'recuperation',
    label: 'Récupération',
    summary: 'Footing très léger après effort ou jour de récup active.',
    purpose: 'Accélérer la récupération sans ajouter de fatigue utile.',
    feel: 'Plus lent et plus court que l’EF. Sensation de « dérouillage ».',
    typical: '20–45 min, le lendemain d’une qualité / course / grosse sortie.',
    zones: 'Z1, bas de Z2 au maximum.',
    tips: 'Mieux vaut trop facile que trop dur. Si ça devient un vrai footing soutenu, taguez EF.',
    zoneIds: ['Z1'],
  },
  {
    id: 'endurance_active',
    label: 'Endurance active',
    summary: 'Un cran au-dessus de l’EF, encore contrôlé.',
    purpose: 'Travailler l’efficacité aérobie et l’allure « marathon / semi confortable ».',
    feel: 'Parler encore possible, mais en phrases plus courtes. Effort soutenu sans forcer.',
    typical: '40–80 min en continu, ou fin de sortie longue progressive.',
    zones: 'Haut Z2 / Z3.',
    tips: 'Ne doit pas devenir un seuil déguisé : si vous grincez des dents, c’est trop.',
    zoneIds: ['Z2', 'Z3'],
  },
  {
    id: 'sortie_longue',
    label: 'Sortie longue',
    summary: 'Volume long, souvent en EF avec éventuellement une fin plus soutenue.',
    purpose: 'Endurance spécifique, résistance mentale, assimilation du volume.',
    typical: '≥ ~75–90 min ou distance nettement au-dessus de vos sorties habituelles.',
    feel: 'Majoritairement facile ; fatigue progressive normale en fin de séance.',
    zones: 'Z1–Z2 la plupart du temps ; un peu de Z3 si progressif.',
    tips: 'Le tag « longue » porte sur le volume, pas sur l’intensité. Terrain trail ≠ type longue.',
    zoneIds: ['Z1', 'Z2'],
  },
  {
    id: 'tempo',
    label: 'Tempo / allure spécifique',
    summary: 'Effort continu à allure course (10 km / semi) ou « confortablement dur ».',
    purpose: 'Habituer le corps à tenir une allure cible longtemps.',
    feel: 'Difficile de parler plus que quelques mots. Contrôlé, pas un sprint prolongé.',
    typical: '15–40 min en continu, ou 2–3 blocs avec récup courte.',
    zones: 'Haut Z3 / bas Z4 selon profil.',
    tips: 'Régularité d’allure importante. Si la FC explose dès le début, l’allure est trop ambitieuse.',
    zoneIds: ['Z3', 'Z4'],
  },
  {
    id: 'seuil',
    label: 'Seuil',
    summary: 'Travail au seuil lactique (continu ou blocs).',
    purpose: 'Repousser le point où l’acide lactique s’accumule ; améliorer le 10 km / semi.',
    feel: 'Dur mais tenable ~20–40 min. Respiration soutenue, concentration.',
    typical: 'ex. 20–30 min continu, ou 3×8–12 min avec récup 2–3 min.',
    zones: 'Z4 (parfois haut Z3 en début de bloc).',
    tips: 'Ce n’est pas de la VMA : si vous devez marcher entre les blocs, c’était trop vite.',
    zoneIds: ['Z4'],
  },
  {
    id: 'fractionne',
    label: 'Fractionné',
    summary: 'Intervalles (400 m, 1000 m…) avec récupérations marquées.',
    purpose: 'Puissance aérobie, vitesse, économie à allure élevée.',
    feel: 'Blocs durs, récup active ou marche selon le protocole. Sensation de séries.',
    typical: 'ex. 8×400 m, 5×1000 m, pyramides — échauffement + retour au calme inclus.',
    zones: 'Z4–Z5 sur les efforts ; Z1–Z2 en récup.',
    tips: 'Le tag fractionné convient dès qu’il y a des répétitions claires, même sans piste.',
    zoneIds: ['Z4', 'Z5'],
  },
  {
    id: 'vma',
    label: 'VMA',
    summary: 'Intervalles courts / moyens autour de la VMA.',
    purpose: 'Améliorer la VO2max et la vitesse maximale aérobie.',
    feel: 'Très intense, respiratoire. Récups souvent égales ou un peu plus longues que l’effort.',
    typical: 'ex. 30/30, 200–400 m, 8–12× (effort 30 s–2 min).',
    zones: 'Z5 (et pics FC élevés).',
    tips: 'Séance courte en volume total d’effort. Ne pas la confondre avec un tempo.',
    zoneIds: ['Z5'],
  },
  {
    id: 'cotes',
    label: 'Côtes',
    summary: 'Répétitions en montée (force, technique, puissance).',
    purpose: 'Renforcement spécifique, économie en côte, sans forcément viser une allure plate.',
    feel: 'Effort en montée, récup en descente ou retour marche. FC monte vite.',
    typical: '6–12 côtes de 30 s–3 min selon pente.',
    zones: 'Souvent Z4–Z5 pendant les montées.',
    tips: 'Le D+ élevé sur une sortie continue n’est pas forcément « côtes » : réservez le tag aux séries.',
    zoneIds: ['Z4', 'Z5'],
  },
  {
    id: 'fartlek',
    label: 'Fartlek',
    summary: 'Variations d’allure libres / ludiques.',
    purpose: 'Jouer avec les accélérations sans protocole rigide.',
    feel: 'Alternance spontanée facile / plus vite (relief, sensations, jeux).',
    typical: '40–70 min avec plusieurs accélérations irrégulières.',
    zones: 'Mixte Z2–Z4 selon les pics.',
    tips: 'Utile quand ce n’est ni un vrai fractionné ni une EF pure.',
    zoneIds: ['Z2', 'Z3', 'Z4'],
  },
  {
    id: 'competition',
    label: 'Compétition',
    summary: 'Course officielle ou simulation compétition.',
    purpose: 'Performance du jour ; sert aussi d’ancre forte pour les prévisions d’allure.',
    feel: 'Effort max contrôlé selon la distance. Peu de place pour « garder sous le pied » inutilement.',
    typical: '5 km, 10 km, semi, marathon, cross…',
    zones: 'Souvent Z4–Z5 selon distance et tactique.',
    tips: 'Taguez aussi les « tests course » officiels. Terrain route/piste préférable pour l’ancre chronos.',
    zoneIds: ['Z4', 'Z5'],
  },
  {
    id: 'test',
    label: 'Test',
    summary: 'Évaluation (VMA, Cooper, chrono contrôlé, etc.).',
    purpose: 'Mesurer le niveau pour recalibrer allures / zones.',
    feel: 'Protocole clair, effort maximal ou submaximal selon le test.',
    typical: 'Cooper 12 min, test VMA piste, 3 km / 5 km chrono, etc.',
    zones: 'Souvent proche Z5 en fin de test.',
    tips: 'Un test récent améliore beaucoup la qualité des suggestions et des prévisions.',
    zoneIds: ['Z5'],
  },
  {
    id: 'autre',
    label: 'Autre',
    summary: 'Séance hors catégories ci-dessus.',
    purpose: 'Ne pas forcer un label faux (renfo + footing, marche active, protocole hybride…).',
    feel: 'Variable.',
    typical: 'Quand aucun type ne décrit correctement l’intention.',
    zones: 'Selon le contenu.',
    tips: 'Préférez un type proche si possible : le coach et les stats y gagnent.',
    zoneIds: [],
  },
]

const BY_ID = new Map(SESSION_TYPE_DOCS.map((d) => [d.id, d]))

export function getSessionTypeDoc(id: string | null | undefined): SessionTypeDoc | null {
  if (!id) return null
  return BY_ID.get(id) ?? null
}
