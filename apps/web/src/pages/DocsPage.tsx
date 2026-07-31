import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { apiFetch } from '../auth'
import { formatPaceSec } from '../format'
import { SESSION_TYPE_DOCS } from '../sessionTypeDocs'
import { sessionToneClass } from '../sessionTone'
import type { PredictionsOverview } from '../types'

type DocTab = {
  id: string
  label: string
}

const TABS: DocTab[] = [
  { id: 'allure', label: 'Allure' },
  { id: 'evolution', label: 'Évolution' },
  { id: 'forme', label: 'Forme' },
  { id: 'seances', label: 'Types de séance' },
  { id: 'cadence', label: 'Cadence' },
  { id: 'apple', label: 'Apple Santé' },
  { id: 'meteo', label: 'Météo' },
  { id: 'coach', label: 'Coach IA' },
]

const SESSION_DOCS = SESSION_TYPE_DOCS

type HrZone = { id: string; label_fr: string; hr_low: number; hr_high: number }

type ProfileDoc = {
  age: number | null
  max_hr: number | null
  resting_hr: number | null
  goal_text: string | null
  zones: {
    available: boolean
    method: string | null
    zones: HrZone[]
  }
}

function zoneRangeLabel(zones: HrZone[], ids: string[]): string | null {
  const matched = zones.filter((z) => ids.includes(z.id))
  if (!matched.length) return null
  const lo = Math.min(...matched.map((z) => z.hr_low))
  const hi = Math.max(...matched.map((z) => z.hr_high))
  const names = matched.map((z) => z.id).join('–')
  return `${names} · ${lo}–${hi} bpm`
}

function Formula({ children }: { children: string }) {
  return <p className="docs-formula">{children}</p>
}

function AllureTab() {
  return (
    <div className="docs-panel">
      <h2>Allure & prévisions</h2>
      <p>
        L’allure est le temps mis pour parcourir un kilomètre. Dans l’app elle s’affiche en{' '}
        <strong>m:ss /km</strong> (plus le chiffre est bas, plus vous êtes rapide).
      </p>

      <h3>Conversion vitesse → allure</h3>
      <p>
        Strava fournit une vitesse moyenne en m/s. On la convertit ainsi :
      </p>
      <Formula>allure (s/km) = 1000 ÷ vitesse_moyenne (m/s)</Formula>
      <p className="muted">
        Exemple : 3,33 m/s ≈ 5:00 /km. Les chronos estimés (5 km, 10 km…) sont{' '}
        <code>allure × distance_km</code>.
      </p>

      <h3>Extrapolation Riegel (page Prévisions)</h3>
      <p>
        Pour passer d’une distance ancre à une autre (5 km → marathon, etc.), on utilise une
        formule déterministe type Riegel, sans IA :
      </p>
      <Formula>p₂ = p₁ × (D₂ ÷ D₁)^0.06</Formula>
      <ul className="docs-list">
        <li>
          <strong>p₁</strong> : allure ancre (s/km) · <strong>D₁</strong> : distance ancre (km)
        </li>
        <li>
          <strong>p₂</strong> : allure cible · <strong>D₂</strong> : distance cible
        </li>
        <li>Résultat borné entre <strong>2:30</strong> et <strong>8:00 /km</strong></li>
      </ul>

      <h3>Choix de l’ancre</h3>
      <p>Priorité, dans l’ordre :</p>
      <ol className="docs-list">
        <li>Compétition ou test récents (≤ 180 jours)</li>
        <li>Séance de qualité taguée (seuil, tempo, fractionné, VMA… ≤ 90 jours)</li>
        <li>Meilleure allure sur une sortie ≥ 5 km (hors EF / récupération)</li>
        <li>Sinon meilleure sortie ≥ 3 km</li>
      </ol>

      <h3>Ajustement de charge</h3>
      <p>
        Un facteur multiplie l’allure (&gt; 1 = un peu plus prudent / plus lent) selon le volume
        récent et l’évolution de vitesse sur 28 jours.
      </p>
      <ul className="docs-list">
        <li>Volume 14 j. &gt; 1,35 × l’équivalent moyen précédent → × 1,02</li>
        <li>Vitesse 28 j. en baisse ≥ 3 % → × 1,02 · en hausse ≥ 3 % → × 0,99</li>
      </ul>

      <h3>Confiance & fourchettes</h3>
      <ul className="docs-list">
        <li>
          <strong>Haute</strong> : ± 3 % · <strong>Moyenne</strong> : ± 5 % ·{' '}
          <strong>Basse</strong> : ± 8 %
        </li>
        <li>Moins de 5 sorties → confiance basse + avertissements</li>
      </ul>

      <h3>Allures d’entraînement</h3>
      <p>
        Si des sorties sont taguées (ex. seuil), on prend la moyenne des 6 dernières pertinentes.
        Sinon on dérive depuis l’allure 10 km estimée avec des coefficients (EF ≈ ×1,20, VMA ≈
        ×0,90, etc.).
      </p>
      <p>
        <Link to="/predictions" className="inline-link">
          Ouvrir Prévisions
        </Link>
      </p>
    </div>
  )
}

function EvolutionTab() {
  return (
    <div className="docs-panel">
      <h2>Évolution (Accueil)</h2>
      <p>
        La section Évolution compare deux fenêtres de <strong>28 jours</strong> : les 28 derniers
        jours vs les 28 jours précédents (J−56 → J−28).
      </p>

      <h3>Indicateurs</h3>
      <ul className="docs-list">
        <li>
          <strong>Total</strong> : km, nombre de sorties, heures (tout l’historique sync)
        </li>
        <li>
          <strong>28 jours</strong> : volume + allure moyenne
        </li>
        <li>
          <strong>Tendances</strong> : variation % du volume et de la vitesse vs fenêtre précédente
        </li>
        <li>
          <strong>Volume hebdomadaire</strong> : jusqu’à 12 semaines ISO
        </li>
      </ul>

      <h3>Catégories</h3>
      <p>Règles déterministes (minimum 5 sorties) :</p>
      <ul className="docs-list">
        <li>
          <strong>Données insuffisantes</strong> — moins de 5 sorties
        </li>
        <li>
          <strong>Charge élevée</strong> — volume 14 j. &gt; 1,35 × moyenne récente équivalente
        </li>
        <li>
          <strong>Progression</strong> — volume ≥ +5 % et/ou vitesse ≥ +3 %, sans baisse nette
        </li>
        <li>
          <strong>Baisse</strong> — volume ≤ −5 % et/ou vitesse ≤ −3 %
        </li>
        <li>
          <strong>Plateau</strong> — sinon
        </li>
      </ul>

      <h3>Forme (ATL / CTL / TSB)</h3>
      <p>
        L’accueil affiche aussi une courbe de forme basée sur la charge TRIMP. Détail des formules
        et des seuils dans l’onglet{' '}
        <Link to="/docs?tab=forme" className="inline-link">
          Forme
        </Link>
        .
      </p>
      <p>
        <Link to="/" className="inline-link">
          Retour à l’Accueil
        </Link>
      </p>
    </div>
  )
}

function FormeTab() {
  return (
    <div className="docs-panel">
      <h2>Forme — ATL, CTL, TSB</h2>
      <p>
        Ces indicateurs mesurent la <strong>charge d’entraînement</strong> dans le temps, à partir
        du <strong>TRIMP</strong> (Training Impulse) de chaque sortie running. Ils s’affichent sur
        l’Accueil (courbe + statut du jour). Ce n’est pas une prédiction d’allure : c’est un
        thermomètre de fatigue / fraîcheur.
      </p>

      <h3>TRIMP (entrée)</h3>
      <p>
        Pour chaque activité, le TRIMP Edwards est calculé à partir du temps passé dans les zones
        FC (profil : FC max / repos ou date de naissance). Sans FC et sans zones profil, la journée
        compte 0 — la forme reste indisponible tant qu’il n’y a pas assez de jours avec TRIMP.
      </p>
      <ul className="docs-list">
        <li>Les TRIMP du même jour UTC sont additionnés</li>
        <li>
          Minimum conseillé : <strong>14 jours</strong> avec TRIMP pour afficher la forme
        </li>
        <li>
          Le CTL se stabilise mieux après ~<strong>42 jours</strong> de charge (sinon note
          « en stabilisation »)
        </li>
      </ul>

      <h3>ATL — Acute Training Load</h3>
      <p>
        Charge <strong>aiguë</strong> : moyenne exponentielle du TRIMP journalier sur une fenêtre
        courte (~<strong>7 jours</strong>). Elle monte vite après un gros bloc ou une semaine
        dense, et redescend en quelques jours de repos relatif.
      </p>
      <ul className="docs-list">
        <li>
          <strong>ATL haute</strong> : fatigue récente / charge courte élevée
        </li>
        <li>
          <strong>ATL basse</strong> : peu de charge récente
        </li>
      </ul>

      <h3>CTL — Chronic Training Load</h3>
      <p>
        Charge <strong>chronique</strong> : même principe, mais sur ~<strong>42 jours</strong>. Elle
        évolue lentement et reflète plutôt le « niveau de forme / fitness » construit sur plusieurs
        semaines.
      </p>
      <ul className="docs-list">
        <li>
          <strong>CTL qui monte</strong> : volume / intensité soutenus dans le temps
        </li>
        <li>
          <strong>CTL qui baisse</strong> : désentraînement relatif ou période légère prolongée
        </li>
      </ul>

      <h3>TSB — Training Stress Balance</h3>
      <Formula>TSB = CTL − ATL</Formula>
      <p>
        Solde entre fitness (CTL) et fatigue récente (ATL). Un TSB <strong>négatif</strong> signifie
        que la charge aiguë dépasse la charge chronique (plus fatigué que « en forme »). Un TSB{' '}
        <strong>positif</strong> indique plutôt de la fraîcheur.
      </p>

      <h3>Statuts affichés dans l’app</h3>
      <ul className="docs-list">
        <li>
          <strong>Fatigue</strong> — TSB ≤ −20
        </li>
        <li>
          <strong>Productif</strong> — −20 &lt; TSB ≤ −5 (charge utile, encore un peu fatigué)
        </li>
        <li>
          <strong>Neutre</strong> — −5 &lt; TSB &lt; 10
        </li>
        <li>
          <strong>Frais</strong> — TSB ≥ 10 (souvent recherché avant une compétition)
        </li>
      </ul>

      <h3>Calcul (EMA)</h3>
      <p>
        Chaque jour, avec le TRIMP du jour (<code>trimp</code>) :
      </p>
      <Formula>ATL ← ATL + (trimp − ATL) ÷ 7</Formula>
      <Formula>CTL ← CTL + (trimp − CTL) ÷ 42</Formula>
      <Formula>TSB ← CTL − ATL</Formula>
      <p>
        Les jours sans sortie (TRIMP = 0) font aussi évoluer les moyennes : la fatigue aiguë
        diminue au repos, la CTL baisse plus lentement.
      </p>

      <h3>Comment l’utiliser</h3>
      <ul className="docs-list">
        <li>Suivre la tendance sur plusieurs semaines, pas un seul jour isolé</li>
        <li>
          Renseigner le <Link to="/profile">profil</Link> (FC) et synchroniser des sorties avec FC
          pour alimenter le TRIMP
        </li>
        <li>
          Le coach et l’adhérence au plan s’appuient aussi sur ce contexte de charge, sans inventer
          de chronos
        </li>
      </ul>
      <p>
        <Link to="/" className="inline-link">
          Voir la courbe sur l’Accueil
        </Link>
      </p>
    </div>
  )
}

function SeancesTab() {
  const [profile, setProfile] = useState<ProfileDoc | null>(null)
  const [pred, setPred] = useState<PredictionsOverview | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      apiFetch('/api/profile'),
      apiFetch('/api/predictions/overview'),
    ])
      .then(async ([pRes, predRes]) => {
        const p = pRes.ok ? ((await pRes.json()) as ProfileDoc) : null
        const pr = predRes.ok ? ((await predRes.json()) as PredictionsOverview) : null
        if (!cancelled) {
          setProfile(p)
          setPred(pr)
        }
      })
      .catch(() => {
        /* doc reste générique */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const paceByType = useMemo(() => {
    const map = new Map<string, { pace: number; source: string; sample: number }>()
    for (const tp of pred?.training_paces ?? []) {
      map.set(tp.session_type, {
        pace: tp.pace_sec_per_km,
        source: tp.source,
        sample: tp.sample_size,
      })
    }
    return map
  }, [pred])

  const pace10k = useMemo(() => {
    const est = pred?.estimates?.find((e) => e.id === '10k')
    return est?.pace_sec_per_km ?? null
  }, [pred])

  const zones = profile?.zones?.available ? profile.zones.zones : []

  return (
    <div className="docs-panel">
      <h2>Types de séance</h2>
      <p>
        Chaque sortie peut porter un <strong>type</strong> (intention d’entraînement) et un{' '}
        <strong>terrain</strong> (Route, Trail, Piste…). Les deux sont indépendants : une EF peut
        être en trail. Les tags améliorent prévisions, suggestions auto et coach.
      </p>
      <p>
        Sur <Link to="/activities">Activités</Link> : classement manuel, multi-sélection, ou
        auto-suggestion (allure, FC/zones, features, profil).
      </p>

      {(profile || pred?.available) && (
        <div className="docs-personal-banner">
          <h3>Pour votre profil</h3>
          <ul className="docs-list">
            {profile?.age != null && (
              <li>
                Âge dérivé : <strong>{profile.age} ans</strong>
                {profile.max_hr != null ? ` · FC max ${profile.max_hr} bpm` : ''}
                {profile.resting_hr != null ? ` · repos ${profile.resting_hr} bpm` : ''}
              </li>
            )}
            {profile?.zones?.available && (
              <li>
                Zones FC ({profile.zones.method === 'karvonen' ? 'Karvonen' : '% FC max'})
                disponibles — affichées sous chaque type.
              </li>
            )}
            {!profile?.zones?.available && (
              <li>
                Complétez FC max / repos (ou date de naissance) dans le{' '}
                <Link to="/profile">profil</Link> pour personnaliser les zones.
              </li>
            )}
            {pace10k != null && (
              <li>
                Allure 10 km estimée : <strong>{formatPaceSec(pace10k)}</strong>
                {pred?.anchor ? ' (sert de référence aux allures d’entraînement).' : '.'}
              </li>
            )}
            {profile?.goal_text && (
              <li>
                Objectif noté : <em>{profile.goal_text}</em>
              </li>
            )}
          </ul>
        </div>
      )}

      <ul className="docs-session-list docs-session-list-rich">
        {SESSION_DOCS.map((s) => {
          const paceInfo = paceByType.get(s.id)
          const hrLabel = zoneRangeLabel(zones, s.zoneIds)
          return (
            <li key={s.id}>
              <div className="docs-session-head">
                <span className={`chip ${sessionToneClass(s.id)}`}>{s.label}</span>
                {(paceInfo || hrLabel) && (
                  <div className="docs-session-personal">
                    {hrLabel && <span className="docs-pill">FC {hrLabel}</span>}
                    {paceInfo && (
                      <span className="docs-pill">
                        Allure ~{formatPaceSec(paceInfo.pace)}
                        {paceInfo.source === 'observe'
                          ? ` (obs. ×${paceInfo.sample})`
                          : ' (dérivée 10k)'}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <p className="docs-session-summary">{s.summary}</p>
              <dl className="docs-session-dl">
                <div>
                  <dt>Pourquoi</dt>
                  <dd>{s.purpose}</dd>
                </div>
                <div>
                  <dt>Sensation</dt>
                  <dd>{s.feel}</dd>
                </div>
                <div>
                  <dt>Typique</dt>
                  <dd>{s.typical}</dd>
                </div>
                <div>
                  <dt>Zones</dt>
                  <dd>
                    {s.zones}
                    {hrLabel ? ` → chez vous ${hrLabel}.` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Conseil</dt>
                  <dd>{s.tips}</dd>
                </div>
              </dl>
            </li>
          )
        })}
      </ul>
      <p>
        <Link to="/activities" className="inline-link">
          Classer mes activités
        </Link>
        {' · '}
        <Link to="/profile" className="inline-link">
          Affiner mon profil
        </Link>
        {' · '}
        <Link to="/predictions" className="inline-link">
          Voir allures estimées
        </Link>
      </p>
    </div>
  )
}

function CadenceTab() {
  return (
    <div className="docs-panel">
      <h2>Cadence</h2>
      <p>
        Strava envoie souvent une cadence en <strong>RPM</strong> (un seul pied). RunningDashboard
        affiche et stocke des <strong>PPM</strong> (pas par minute, les deux pieds).
      </p>
      <Formula>PPM = RPM × 2</Formula>
      <ul className="docs-list">
        <li>
          Priorité : moyenne Strava (ou laps) → sinon moyenne du stream cadence
        </li>
        <li>
          Recalcul local possible dans Admin (pas besoin de resync)
        </li>
        <li>
          Saisie manuelle possible sur le détail si la donnée manque (plage typique 80–250 PPM)
        </li>
        <li>
          Si Apple Forme n’envoie pas la cadence à Strava, importez un export Apple Santé
          (Admin) pour enrichir les trous, ou saisissez la PPM manuellement
        </li>
      </ul>
      <p>
        <Link to="/admin" className="inline-link">
          Ouvrir Admin
        </Link>
      </p>
    </div>
  )
}

function AppleTab() {
  return (
    <div className="docs-panel">
      <h2>Apple Santé</h2>
      <p>
        Strava reste la sync principale. Apple Santé s’importe via le ZIP d’export officiel
        (workouts course / marche / randonnée).
      </p>
      <ul className="docs-list">
        <li>
          iPhone → Santé → profil → <strong>Exporter les données Santé</strong> → ZIP
        </li>
        <li>Admin → Import Apple Santé → upload du ZIP</li>
        <li>
          Matching sur début / distance / durée : candidats affichés ; lien haute confiance
          automatique si candidat unique
        </li>
        <li>
          Lien → enrichit uniquement les <strong>trous</strong> (cadence, FC…) — jamais
          d’écrasement des valeurs Strava
        </li>
        <li>Sans match → création d’une activité source Apple</li>
        <li>Sur le détail d’une sortie Strava : lier / délier un workout Apple</li>
      </ul>
      <p>
        <Link to="/admin" className="inline-link">
          Ouvrir Admin
        </Link>
      </p>
    </div>
  )
}

function MeteoTab() {
  return (
    <div className="docs-panel">
      <h2>Météo</h2>
      <p>
        À chaque Sync, les sorties avec GPS (hors indoor) peuvent être enrichies via{' '}
        <strong>Open-Meteo</strong> (archive + forecast). On prend l’heure horaire la plus proche du
        départ. Utile aussi au coach pour contextualiser une séance.
      </p>
      <ul className="docs-list">
        <li>Température, ressenti, humidité, précipitations, vent, conditions (libellé FR)</li>
        <li>Quota limité par passage de sync (enrichissement progressif)</li>
        <li>
          Sur l’Accueil : moyenne des températures et part de sorties sous pluie (
          <code>précipitations &gt; 0</code>)
        </li>
      </ul>
    </div>
  )
}

function CoachTab() {
  return (
    <div className="docs-panel">
      <h2>Coach IA</h2>
      <p>
        Ollama local (7B / 14B). Le <strong>plan calendrier</strong> est persisté et rafraîchi hors
        question libre (sync ou bouton Rafraîchir). Chaque sortie peut avoir sa propre analyse.
        Pack knowledge dans <code>apps/api/app/knowledge/</code>.
      </p>
      <ul className="docs-list">
        <li>
          <code>OLLAMA_KEEP_ALIVE=-1</code> : modèle gardé en RAM
        </li>
        <li>Chiffres déterministes ; l’IA commente seulement</li>
        <li>
          Page <Link to="/profile">Profil</Link> : date de naissance, zones FC, VO2max, historique
          des enregistrements. Page <Link to="/predictions">Prévisions</Link> : bilan, allures,
          projection et corrélation FC × météo à allure comparable.
        </li>
      </ul>
      <p>
        <Link to="/coach" className="inline-link">
          Ouvrir le Coach
        </Link>
        {' · '}
        <Link to="/profile" className="inline-link">
          Profil
        </Link>
      </p>
    </div>
  )
}

function TabContent({ id }: { id: string }) {
  switch (id) {
    case 'evolution':
      return <EvolutionTab />
    case 'forme':
      return <FormeTab />
    case 'seances':
      return <SeancesTab />
    case 'cadence':
      return <CadenceTab />
    case 'apple':
      return <AppleTab />
    case 'meteo':
      return <MeteoTab />
    case 'coach':
      return <CoachTab />
    case 'allure':
    default:
      return <AllureTab />
  }
}

export function DocsPage() {
  const [params, setParams] = useSearchParams()
  const active = useMemo(() => {
    const raw = params.get('tab') ?? 'allure'
    return TABS.some((t) => t.id === raw) ? raw : 'allure'
  }, [params])

  return (
    <>
      <header className="page-hero">
        <h1>Documentation</h1>
        <p>
          Concepts, formules et règles utilisés par RunningDashboard. Les chiffres (allures,
          analytics) restent déterministes ; le coach IA les commente sans les inventer.
        </p>
      </header>

      <div className="docs-tabs" role="tablist" aria-label="Sections de documentation">
        {TABS.map((tab) => {
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`docs-tab ${selected ? 'active' : ''}`}
              onClick={() => {
                setParams(tab.id === 'allure' ? {} : { tab: tab.id })
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="panel-block docs-content" role="tabpanel">
        <TabContent id={active} />
      </div>
    </>
  )
}
