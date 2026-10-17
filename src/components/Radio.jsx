import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import { useSourceDrum } from './useSourceDrum.js'
import { pathFor } from '../../sites.config.js'
import { stepStation } from '../radioCycle.js'

/* Live broadcast console — a native HTML5 <audio> player for Public Radio of
 * Armenia. We deliberately do NOT embed player.armradio.am (an old jQuery/jPlayer
 * widget that ships Google Analytics, third-party cookies and a Cloudflare
 * challenge, and can't be restyled). Instead we stream the same Shoutcast mounts
 * directly — HTTPS only, no third-party JS, fully on-brand.
 *
 * Stream URLs come from player.armradio.am/index.php?c=all. The upstream also
 * lists "Yezidi Radio" on http://46.182.174.131:8002/music — deliberately left
 * out: a plain-HTTP stream would be blocked as mixed content on our HTTPS site.
 *
 * Radio Mariam Armenia (radiomariam.am) also streams only over plain HTTP
 * (http://bkmx.euriconsult.eu:8000/RadioMariam), so it goes through an HTTPS
 * Cloudflare Worker proxy (see proxy/radio-mariam-worker.js).
 *
 * Voice of Van (voiceofvan.net) already streams over HTTPS, so it is used
 * directly. Its host blocks datacenter IPs, so it can't be proxied — it only
 * plays from real (residential) browsers. */
const MARIAM_PROXY = 'https://radio-mariam-proxy.cobranian.workers.dev/'
const VOV_STREAM = 'https://vovan.s3ming.com/vovan.mp3?_=1'
// Radio Yeraz streams only over plain HTTP from streaming05.liveboxstream.uk:8008,
// so it goes through an HTTPS Cloudflare Worker proxy (see proxy/radio-yeraz-worker.js).
const YERAZ_PROXY = 'https://radio-yeraz-proxy.cobranian.workers.dev/'

/* `offAir` : la station est SILENCIEUSE CHEZ ELLE, pas cassée chez nous.
 *
 * Le cas qui a introduit ce drapeau — Im Radio, le 10 août 2026. Son mount
 * répond 401 « The resource requested is currently unavailable », et c'est le
 * DNAS lui-même qui le dit :
 *
 *   curl -s '<mount>/statistics?json=1'
 *   Im Radio (aamiry02) : "activestreams":0, streamstatus 0, bitrate 0
 *   Arevik  (aamiryan)  : "activestreams":1, streamstatus 1, bitrate 128
 *
 * Le 17 octobre 2026, Im Radio est revenue (`activestreams` 1, CORS présent :
 * elle repasse par l'analyseur) et c'est Armenian Gospel Radio qui s'est tue —
 * même diagnostic sur son propre DNAS (`s8.myradiostream.com:15554`) : 401,
 * `activestreams` 0. Le drapeau a changé de station, pas de sens.
 *
 * TROIS MESURES À CONNAÎTRE AVANT DE « RÉPARER » UNE URL DE CE TABLEAU, parce
 * que chacune écarte une fausse piste qui coûte une heure :
 *
 * - **401 et 404 ne disent pas la même chose.** Un mount inexistant répond 404
 *   (vérifié sur `aamiry03`, `imradio`) ; 401 signifie que le compte existe et
 *   qu'aucun encodeur n'y est connecté. Un 401 n'est donc JAMAIS une URL
 *   périmée — la chercher ailleurs est du temps perdu.
 * - **L'URL vient du lecteur officiel** (`player.armradio.am/index.php?c=all`),
 *   relu le jour même : il sert exactement ce mount. Le site propre de la
 *   station (`imradio.armradio.am`) renvoie à ce même lecteur. La Radio
 *   publique d'Arménie est donc muette pour tout le monde, pas pour nous.
 * - **Le port direct ne sauve rien.** Les agrégateurs (Radoxo) diffusent la
 *   forme `eu1.stream4cast.com:8070` : c'est le MÊME DNAS, même 401.
 *
 * Ce qu'une station marquée `offAir` fait : elle reste listée et comptée —
 * retirer une puce ferait mentir les quatorze textes qui écrivent « quinze » en
 * toutes lettres dans quatre langues, descriptions Google comprises, et tout
 * serait à refaire à l'envers le jour du retour. Sa puce est simplement inerte
 * et porte « hors antenne ».
 *
 * POUR SAVOIR QUAND RETIRER LE DRAPEAU : `npm run radio-check`. Il interroge
 * les quinze flux et signale les deux écarts — une station muette qui n'est pas
 * marquée, et une station marquée qui rediffuse. Rien d'autre ne le dira : un
 * flux qui meurt chez l'hébergeur ne fait échouer ni test, ni lint, ni build. */
const STATIONS = [
  { id: 'public', stream: 'https://eu1.stream4cast.com/proxy/publicra/stream' },
  { id: 'im', stream: 'https://eu1.stream4cast.com/proxy/aamiry02/stream' },
  { id: 'arevik', stream: 'https://eu1.stream4cast.com/proxy/aamiryan/stream' },
  { id: 'culture', stream: 'https://eu1.stream4cast.com/proxy/aamiry01/stream' },
  { id: 'mariam', stream: MARIAM_PROXY },
  // `plain`: no CORS headers, so it can't feed the Web Audio graph (that would
  // require crossOrigin and mute it). It plays through a bare <audio> element
  // instead — no live spectrum, just the calm idle pulse.
  { id: 'vov', stream: VOV_STREAM, plain: true },
  // Independent Armenian stations. All four stream over HTTPS and send
  // Access-Control-Allow-Origin: *, so they run through the analyser like the
  // stream4cast mounts above (verified live). Radio Fama's stream4cast account
  // is 'rmirzakh'; Yerevan Nights and Armenian Gospel Radio use their own hosts.
  { id: 'lav', stream: 'https://eu.stream4cast.com/proxy/lavradio/stream' },
  { id: 'fama', stream: 'https://eu.stream4cast.com/proxy/rmirzakh/stream' },
  { id: 'yerevannights', stream: 'https://icecast.worldweb.services/Web' },
  // Direct port URL: the path form (/15554/listen.mp3) 302-redirects here, and
  // the CSP host-source must name the non-default port explicitly.
  { id: 'gospel', stream: 'https://s8.myradiostream.com:15554/listen.mp3', offAir: true },
  { id: 'yeraz', stream: YERAZ_PROXY },
  // Radio Jazz FM (89.3 MHz, Erevan) — the only jazz station of the set. Like
  // the stream4cast mounts it is HTTPS and sends Access-Control-Allow-Origin: *,
  // so it feeds the analyser directly: no proxy, no `plain` flag. Its 256 kbps
  // mount is the highest bitrate here (the section eyebrow still says 128 —
  // it describes the common case, not this one).
  { id: 'jazz', stream: 'https://am.radioaurora.am/jz' },
  /* Trois ajouts du 11 août 2026. Les URL viennent des stations elles-mêmes,
   * jamais d'un annuaire : mytuner et onlineradiobox CHIFFRENT le flux dans
   * leur page (`cipher` + `iv`), et une URL déchiffrée chez eux ne serait de
   * toute façon qu'une copie de celle du site officiel, en plus fragile.
   *
   * LE PIÈGE, ET IL EST SILENCIEUX : `crossOrigin="anonymous"` sur l'élément de
   * l'analyseur EXIGE `Access-Control-Allow-Origin` sur la réponse du flux.
   * Sans cet en-tête, le navigateur n'assourdit pas le son : il refuse de
   * charger la ressource. La station ne joue pas du tout, et rien dans le
   * dépôt ne le dit. Deux des trois sont dans ce cas, et ça ne se DEVINE PAS
   * de l'URL — vem et arradioi vivent sur le même hôte
   * (`eu1.stream4cast.com`) et n'ont pas le même serveur derrière :
   *
   *   arradioi → Shoutcast DNAS, `Access-Control-Allow-Origin: *`  → analyseur
   *   vemradio → Icecast (`ice-audio-info`), AUCUN en-tête CORS     → `plain`
   *
   * Un `curl -s -D - -o /dev/null -H 'Origin: https://armenieinfo.ch' <flux>`
   * tranche en une seconde ; `npm run radio-check` affiche le débit mais PAS
   * cet en-tête (il vérifie que ça diffuse, pas que ça se branche à Web
   * Audio). À vérifier à la main pour toute station ajoutée. */
  // Vem Radio (vem.am) — la radio spirituelle de l'Église arménienne, 320 kbps
  // (le plus haut débit du lot). Icecast sans CORS, donc `plain` : lecture
  // nue, pas de spectre.
  { id: 'vem', stream: 'https://eu1.stream4cast.com/proxy/vemradio/stream', plain: true },
  // Radio Yerevan, l'antenne d'AR Radio Intercontinental (arradio.am), le plus
  // grand réseau FM d'Arménie. Son site publie un `.pls` qui résout en HTTP
  // simple sur IP nue (`217.182.133.119:8160`) — inutilisable ici, ce serait du
  // contenu mixte. Le même flux est servi en HTTPS par le mount stream4cast du
  // réseau, avec CORS : pas de proxy à monter, contrairement à mariam et yeraz.
  { id: 'yerevanfm', stream: 'https://eu1.stream4cast.com/proxy/arradioi/stream' },
  // Yeridasartoutian Tsayne — la SECONDE antenne de Beyrouth du lecteur, à
  // côté de Voice of Van (le lot compte aussi Yerevan Nights, de Glendale :
  // la diaspora y était déjà). URL prise dans le <audio> de son
  // propre site. Nouvel hôte média : il a fallu l'ajouter à `media-src` dans
  // LES DEUX blocs de firebase.json — la préversion ne joue pas la CSP, donc
  // l'oubli ne se voit qu'en production. Sans CORS lui aussi → `plain`.
  { id: 'tsayn', stream: 'https://cast5.asurahosting.com/proxy/jean/live', plain: true },
]

// Passage automatique à la station suivante quand un flux est indisponible
// (voir `skipFrom`). Un flux qui charge plus longtemps que ceci sans jouer est
// tenu pour indisponible : certains serveurs morts n'émettent jamais d'erreur.
const STALL_MS = 15000
// Hors réseau, on attend son retour au plus ce temps-là pour reprendre seul.
// Au-delà, l'auditeur est sans doute passé à autre chose : une radio qui
// repartirait d'elle-même des heures plus tard, sur le haut-parleur, serait pire
// que pas de reprise du tout.
const ONLINE_WAIT_MS = 5 * 60 * 1000
const PLAYABLE = STATIONS.filter((s) => !s.offAir).length

// L'élément <audio> d'une station — la seule écriture de cette règle (voir
// `elFor`). Au niveau du module pour que les gestionnaires posés une fois au
// montage puissent s'en servir sans dépendance d'effet.
const pickEl = (s, cors, plain) => (s?.plain ? plain : cors)

const mediaSession = () =>
  typeof navigator !== 'undefined' ? navigator.mediaSession : null

const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

// A live Yerevan clock — "broadcasting from Erevan, right now".
function useYerevanClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const fmt = () => {
      try {
        setTime(
          new Intl.DateTimeFormat('fr-FR', {
            timeZone: 'Asia/Yerevan',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date()),
        )
      } catch {
        setTime('')
      }
    }
    fmt()
    const id = setInterval(fmt, 15000)
    return () => clearInterval(id)
  }, [])
  return time
}

// `more` : afficher ou non le lien vers /radio/ sous le lecteur.
//
// Il n'a de sens QUE sur l'accueil. Sur /radio/ le lecteur est déjà à
// destination : le lien y pointerait sur la page courante, et le clic
// déclencherait une navigation de document — donc un rechargement qui COUPE le
// flux qu'on est en train d'écouter. D'où un drapeau plutôt qu'un second
// composant : deux lecteurs divergeraient au premier correctif.
export function Radio({ more = true }) {
  const { t, lang } = useI18n()
  const time = useYerevanClock()

  const audioRef = useRef(null) // CORS streams → Web Audio graph (live spectrum)
  const plainAudioRef = useRef(null) // CORS-less streams → bare playback, no graph
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(0)

  const [stationId, setStationId] = useState('public')
  const stationIdRef = useRef(stationId) // voir `pick`
  const wantRef = useRef(false) // l'auditeur veut entendre quelque chose (voir `skipFrom`)
  const failsRef = useRef(0) // stations sautées d'affilée sans qu'aucune ne joue
  const onlineWaitRef = useRef(null) // { cancel } tant qu'on attend le réseau
  const lapStartRef = useRef(null) // station d'où est parti un tour de sauts
  // Élément que le composant met lui-même en pause (changement de station) :
  // son événement `pause` ne vient pas de l'auditeur. Voir `onPause`.
  const ownPauseRef = useRef(null)
  // Incrémenté à chaque tentative de lecture : réarme la minuterie de
  // chargement même quand `loading` était déjà levé.
  const [attempt, setAttempt] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [volume, setVolume] = useState(0.85)

  const station = STATIONS.find((s) => s.id === stationId) || STATIONS[0]
  const isPlain = !!station.plain
  // The <audio> a station uses: CORS streams run through the analyser graph;
  // CORS-less ones use a bare element that is never fed to Web Audio (feeding a
  // non-CORS source to Web Audio would mute it), so they still play.
  const elFor = (s) => pickEl(s, audioRef.current, plainAudioRef.current)
  const elOf = (id) => elFor(STATIONS.find((s) => s.id === id))
  // À appeler juste AVANT un `pause()` du composant sur un élément en lecture,
  // pour que `onPause` ne le prenne pas pour un arrêt voulu par l'auditeur.
  const markOwnPause = (el) => {
    if (el && !el.paused) ownPauseRef.current = el
  }
  // Changer `src` relance le chargement, qui SUPPRIME les événements encore en
  // file pour cet élément — dont le `pause` qu'on vient de marquer — et qui ne
  // réémet pas de `pause` (il bascule `paused` en silence). Le marqueur doit
  // donc tomber avec : resté posé, il ferait prendre la prochaine vraie pause
  // (appel, Bluetooth coupé) pour un changement de station, et la radio
  // sauterait à la suivante au lieu de rester arrêtée. Mesuré en Chrome.
  const setSrc = (el, url) => {
    el.src = url
    if (ownPauseRef.current === el) ownPauseRef.current = null
  }

  // --- Web Audio wiring (built once, on first user gesture) ---
  function ensureGraph() {
    if (analyserRef.current || !audioRef.current) return
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      const ctx = new AC()
      const source = ctx.createMediaElementSource(audioRef.current)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      analyser.smoothingTimeConstant = 0.82
      source.connect(analyser)
      analyser.connect(ctx.destination)
      ctxRef.current = ctx
      analyserRef.current = analyser
    } catch {
      /* Web Audio unavailable — audio still plays through the element. */
    }
  }

  async function play() {
    const audio = elFor(station)
    if (!audio) return
    wantRef.current = true
    failsRef.current = 0
    // only one element ever plays
    ;(isPlain ? audioRef.current : plainAudioRef.current)?.pause()
    setError(false)
    setLoading(true)
    setAttempt((a) => a + 1)
    // Un élément resté en erreur ne se relance pas par un simple `play()` : le
    // navigateur le refuse tant que la source n'est pas rechargée. Sans ce
    // rechargement, « Réessayer » et la reprise au retour du réseau échouaient,
    // et la reprise faisait sauter une station qui marchait.
    if (audio.src !== station.stream || audio.error) setSrc(audio, station.stream)
    if (!isPlain) {
      ensureGraph()
      if (ctxRef.current?.state === 'suspended') {
        try {
          await ctxRef.current.resume()
        } catch {
          /* ignore */
        }
      }
    }
    try {
      await audio.play()
    } catch (err) {
      failed(station.id, err)
    }
  }

  function pause() {
    wantRef.current = false
    elFor(station)?.pause()
    // Une pause pendant un chargement (ou après un `stalled`) laisserait
    // `loading` levé : l'écran verrouillé, qui compte le chargement comme
    // lecture, resterait bloqué sur ⏸. On ne le baisse PAS dans le gestionnaire
    // `pause` de l'élément : au changement de station, l'ancien élément émet
    // `pause` après que `pick` a levé `loading` pour le nouveau.
    setLoading(false)
  }

  function toggle() {
    if (playing) pause()
    else play()
  }

  // `force` : lancer la lecture même à l'arrêt — c'est ce que veut un ⏭ pressé
  // sur l'écran de verrouillage. Un clic sur une puce, lui, ne lance rien.
  function pick(id, force = false) {
    // La station courante est lue dans une référence, pas dans l'état : deux ⏭
    // pressés avant le rendu suivant liraient sinon la même station, le second
    // serait perdu — et `prev` désignerait le mauvais élément, laissant deux
    // flux jouer en même temps.
    const cur = stationIdRef.current
    if (id === cur) {
      if (force && !playing) play()
      return
    }
    const prev = STATIONS.find((s) => s.id === cur)
    const next = STATIONS.find((s) => s.id === id)
    // Une station hors antenne ne se sélectionne pas — ni au clic (sa puce est
    // `aria-disabled`), ni quand le TAMBOUR mobile s'immobilise sur son rang.
    //
    // C'est ce second chemin qui compte : `useSourceDrum` appelle `pick` avec
    // le rang arrêté au centre, sans savoir ce qu'est une station. Sans cette
    // garde, faire tourner la roue jusqu'à une station hors antenne couperait le flux en cours
    // pour un mount qui répond 401 — donc « Flux indisponible. » et un bouton
    // « Réessayer » qui ne peut pas aboutir, à la place d'une station qui
    // jouait. La roue reste posée sur son rang, qui porte « hors antenne » en
    // toutes lettres : elle explique elle-même pourquoi rien n'a changé.
    if (!next || next.offAir) return
    stationIdRef.current = id
    setStationId(id)
    const prevEl = elFor(prev)
    markOwnPause(prevEl)
    prevEl?.pause() // stop whatever the previous station was using
    const audio = elFor(next)
    if (!audio) return
    setSrc(audio, next.stream)
    if (playing || loading || force) {
      wantRef.current = true
      setLoading(true)
      setError(false)
      setAttempt((a) => a + 1)
      if (!next.plain) {
        ensureGraph()
        if (ctxRef.current?.state === 'suspended') ctxRef.current.resume().catch(() => {})
      }
      audio.play().catch((err) => failed(id, err))
    }
  }

  // `play()` a été refusé pour la station `id`.
  function failed(id, err) {
    // Lecture remplacée par un changement de station (deux ⏭ rapides) : rien
    // n'est en panne, la nouvelle station est déjà en route.
    if (err?.name === 'AbortError') return
    // La même panne remonte souvent deux fois (événement `error` ET refus de
    // `play()`). Si la première a déjà fait sauter la station, la seconde
    // arrive en retard : elle afficherait « Flux indisponible » sur la station
    // suivante, en plein chargement.
    if (id !== stationIdRef.current) return
    setLoading(false)
    setError(true)
    // Lecture automatique refusée par le navigateur : une autre station serait
    // refusée de même. Seul un geste de l'auditeur débloque.
    if (err?.name === 'NotAllowedError') return
    skipFrom(id)
  }

  // Le flux de la station `id` est indisponible : on passe à la suivante, sans
  // que l'auditeur ait à déverrouiller son téléphone (demandé après un essai en
  // voiture). Trois garde-fous :
  // - seulement si l'auditeur veut écouter (pas après une pause) et si `id` est
  //   toujours la station courante — la même panne remonte souvent deux fois
  //   (refus de `play()` ET événement `error`), la seconde ne doit rien sauter ;
  // - hors réseau (un tunnel), changer de station ne servirait à rien : chacune
  //   échouerait en une fraction de seconde et on finirait arrêté. On attend le
  //   retour du réseau et on reprend la station courante ;
  // - après un tour complet sans qu'aucune station ne joue, on s'arrête sur
  //   « Flux indisponible » au lieu de tourner sans fin.
  function skipFrom(id) {
    if (!wantRef.current || id !== stationIdRef.current) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      waitForNetwork()
      return
    }
    if (failsRef.current === 0) lapStartRef.current = id
    failsRef.current += 1
    if (failsRef.current >= PLAYABLE) {
      giveUp()
      return
    }
    pick(stepStation(STATIONS, id, 1), true)
  }

  // Tour complet sans qu'aucune station ne joue : on s'arrête, quel que soit le
  // chemin qui y a mené (erreur, refus, ou chargement sans fin — ce dernier ne
  // posait ni `error` ni arrêt de l'élément, et le lecteur restait sur
  // « Connexion au flux… »). On revient sur la station que l'auditeur avait
  // choisie : « Réessayer » doit relancer la sienne, pas la dernière essayée.
  function giveUp() {
    const el = elOf(stationIdRef.current)
    markOwnPause(el)
    el?.pause()
    wantRef.current = false
    failsRef.current = 0
    cancelNetworkWait()
    const origin = lapStartRef.current
    lapStartRef.current = null
    if (origin && origin !== stationIdRef.current) {
      stationIdRef.current = origin
      setStationId(origin)
    }
    setLoading(false)
    setError(true)
  }

  // Hors réseau (tunnel) : changer de station ne servirait à rien, chacune
  // échouerait en une fraction de seconde. On reprend la station COURANTE au
  // retour du réseau — un ⏭ pressé entre-temps a pu la changer — et seulement
  // si elle ne joue pas déjà : le lecteur du navigateur se reconnecte parfois
  // seul avant que l'événement `online` n'arrive. L'attente expire au bout de
  // ONLINE_WAIT_MS, et une pause de l'auditeur l'annule.
  function waitForNetwork() {
    if (onlineWaitRef.current) return
    const onOnline = () => {
      cancelNetworkWait()
      if (wantRef.current) sessionRef.current?.resume()
    }
    const timer = setTimeout(() => {
      cancelNetworkWait()
      wantRef.current = false
    }, ONLINE_WAIT_MS)
    window.addEventListener('online', onOnline)
    onlineWaitRef.current = {
      cancel: () => {
        clearTimeout(timer)
        window.removeEventListener('online', onOnline)
      },
    }
  }

  function cancelNetworkWait() {
    onlineWaitRef.current?.cancel()
    onlineWaitRef.current = null
  }

  // Relance la station courante si elle ne joue pas (en pause, en erreur, ou
  // sans données) — jamais par-dessus un flux qui s'est déjà rétabli.
  function resume() {
    const el = elFor(station)
    if (el && (el.paused || el.error || el.readyState < 3)) play()
  }

  // L'élément a été mis en pause par quelqu'un d'autre que le composant :
  // l'auditeur, ou le système (appel entrant, Bluetooth de la voiture coupé,
  // casque débranché). C'est un arrêt voulu : plus de saut ni de reprise
  // automatique, sinon la radio repartirait seule sur le haut-parleur.
  function stoppedFromOutside() {
    wantRef.current = false
    cancelNetworkWait()
    setLoading(false)
  }

  // Le flux de `id` charge depuis STALL_MS. Un `stalled` peut lever `loading`
  // alors que le tampon joue encore et que les données reviennent sans qu'un
  // nouveau `playing` ne parte : si l'élément joue (pas en pause, données
  // d'avance disponibles), c'était une fausse alerte, on baisse seulement le
  // voyant. Sinon, la station est indisponible.
  function stallCheck(id) {
    if (id !== stationIdRef.current) return
    const el = elOf(id)
    if (el && !el.paused && el.readyState >= 3) {
      setLoading(false)
      return
    }
    skipFrom(id)
  }

  // Un flux qui reste en chargement sans jamais jouer ni échouer.
  useEffect(() => {
    if (!loading) return
    const id = stationIdRef.current
    const timer = setTimeout(() => sessionRef.current?.stallCheck(id), STALL_MS)
    return () => clearTimeout(timer)
  }, [loading, stationId, attempt])

  // Keep both elements' volume in sync.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
    if (plainAudioRef.current) plainAudioRef.current.volume = volume
  }, [volume])

  // Wire <audio> events to UI state. Both elements share the handlers; only one
  // ever plays at a time, so the state always reflects the active stream.
  useEffect(() => {
    const els = [audioRef.current, plainAudioRef.current].filter(Boolean)
    const onPlaying = () => {
      failsRef.current = 0
      setPlaying(true)
      setLoading(false)
      setError(false)
    }
    // Un élément en pause (arrêt voulu) ou quitté peut encore émettre `stalled`
    // pendant que sa connexion meurt : le voyant ne doit pas repartir.
    const onWaiting = (e) => {
      if (!e.target.paused && currentFor(e.target)) setLoading(true)
    }
    // La station écoutée, si `el` est bien son élément ; sinon null. Un élément
    // qu'on vient de quitter peut encore émettre : ce n'est pas la station
    // écoutée, ni l'affichage ni le saut ne le regardent.
    const currentFor = (el) => {
      const cur = STATIONS.find((s) => s.id === stationIdRef.current)
      return el === pickEl(cur, audioRef.current, plainAudioRef.current) ? cur : null
    }
    const onPause = (e) => {
      setPlaying(false)
      if (ownPauseRef.current === e.target) {
        ownPauseRef.current = null // changement de station : rien à faire
        return
      }
      // Fin de flux (le serveur a fermé : `pause` puis `ended`) ou flux en
      // erreur (Chrome émet `pause` APRÈS `error`, mesuré) : ce sont des pannes,
      // `onFail` les traite. Les prendre pour un arrêt voulu couperait le saut
      // et la reprise au retour du réseau.
      if (e.target.ended || e.target.error || !currentFor(e.target)) return
      sessionRef.current?.stoppedFromOutside()
    }
    const onFail = (e) => {
      const cur = currentFor(e.target)
      if (!cur) return
      setPlaying(false)
      setLoading(false)
      setError(true)
      sessionRef.current?.skipFrom(cur.id)
    }
    els.forEach((el) => {
      el.addEventListener('playing', onPlaying)
      el.addEventListener('waiting', onWaiting)
      el.addEventListener('pause', onPause)
      el.addEventListener('stalled', onWaiting)
      el.addEventListener('error', onFail)
      el.addEventListener('ended', onFail)
    })
    return () =>
      els.forEach((el) => {
        el.removeEventListener('playing', onPlaying)
        el.removeEventListener('waiting', onWaiting)
        el.removeEventListener('pause', onPause)
        el.removeEventListener('stalled', onWaiting)
        el.removeEventListener('error', onFail)
        el.removeEventListener('ended', onFail)
      })
  }, [])

  // --- Écran de verrouillage (Media Session) ---
  // Android remplit le lecteur de l'écran verrouillé et de la notification à
  // partir de `navigator.mediaSession` : nom de la station, marque du site,
  // l'Ararat, et les boutons ⏮ ⏯ ⏭. Sans gestionnaire `nexttrack` /
  // `previoustrack`, ces deux boutons n'apparaissent pas.
  //
  // Les gestionnaires sont posés UNE fois et passent par une référence remise à
  // jour à chaque rendu : posés avec `play` / `pick` directement, ils
  // garderaient la station du montage et ⏭ repartirait toujours de la première.
  const sessionRef = useRef(null)
  sessionRef.current = {
    play,
    pause,
    skipFrom,
    stallCheck,
    resume,
    stoppedFromOutside,
    cancelNetworkWait,
    step: (dir) => {
      failsRef.current = 0
      pick(stepStation(STATIONS, stationIdRef.current, dir), true)
    },
  }

  useEffect(() => {
    const ms = mediaSession()
    if (!ms) return
    const actions = {
      play: () => sessionRef.current.play(),
      pause: () => sessionRef.current.pause(),
      stop: () => sessionRef.current.pause(),
      previoustrack: () => sessionRef.current.step(-1),
      nexttrack: () => sessionRef.current.step(1),
    }
    const poser = (a, h) => {
      try {
        ms.setActionHandler(a, h)
      } catch {
        /* action inconnue de ce navigateur — les autres restent posées */
      }
    }
    for (const [a, h] of Object.entries(actions)) poser(a, h)
    return () => Object.keys(actions).forEach((a) => poser(a, null))
  }, [])

  useEffect(() => {
    const ms = mediaSession()
    if (!ms || typeof MediaMetadata === 'undefined') return
    const icon = new URL(`${import.meta.env.BASE_URL}favicon-192.png`, location.href).href
    ms.metadata = new MediaMetadata({
      title: t(`radio.st.${stationId}`),
      artist: t('site.title'),
      artwork: [{ src: icon, sizes: '192x192', type: 'image/png' }],
    })
  }, [stationId, t])

  useEffect(() => {
    const ms = mediaSession()
    // `loading` compte comme lecture : au changement de station, l'ancien
    // élément émet `pause` avant que le nouveau ne joue, et l'écran verrouillé
    // basculerait sur ▶ le temps du chargement.
    if (ms) ms.playbackState = playing || loading ? 'playing' : 'paused'
  }, [playing, loading])

  // --- Spectrum visualizer ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')
    let width = 0
    let height = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      width = r.width
      height = r.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const accent = () =>
      getComputedStyle(canvas).getPropertyValue('--apricot').trim() || '#f2a93b'
    const bars = 48
    const gap = 3
    const reduced = prefersReducedMotion()

    const draw = () => {
      ctx2d.clearRect(0, 0, width, height)
      const bw = (width - gap * (bars - 1)) / bars
      const col = accent()
      // Plain (CORS-less) stations never feed the analyser, so they show the
      // calm live pulse rather than a real spectrum.
      const spectral = !!analyserRef.current && playing && !reduced && !isPlain
      const analyser = analyserRef.current
      const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
      if (spectral) analyser.getByteFrequencyData(data)

      for (let i = 0; i < bars; i++) {
        let v
        if (spectral) {
          // sample across the spectrum, weight the low-mids
          const idx = Math.floor((i / bars) * (data.length * 0.8))
          v = data[idx] / 255
        } else if (playing) {
          // live but no spectrum (reduced-motion or CORS-less): a calm pulse
          v = 0.28 + 0.12 * Math.sin(i * 0.6)
        } else {
          // idle baseline
          v = 0.06 + 0.05 * Math.sin(i * 0.5)
        }
        const bh = Math.max(2, v * height)
        const x = i * (bw + gap)
        const y = (height - bh) / 2
        ctx2d.fillStyle = col
        ctx2d.globalAlpha = playing ? 0.9 : 0.35
        ctx2d.fillRect(x, y, bw, bh)
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [playing, isPlain])

  // Teardown on unmount.
  useEffect(() => {
    const session = sessionRef // l'attente du réseau ne doit pas survivre au lecteur
    return () => {
      session.current?.cancelNetworkWait()
      cancelAnimationFrame(rafRef.current)
      audioRef.current?.pause()
      plainAudioRef.current?.pause()
      ctxRef.current?.close?.()
    }
  }, [])

  const stationName = (id) => t(`radio.st.${id}`)

  // Sous 640px, la rangée de puces passe en `nowrap` + `overflow-x` (voir
  // global.css) : deux stations sur quinze se voient à 360px, trois à 560px, et
  // `scrollbar-width: none` fait qu'aucun indice ne dit que les autres
  // existent. Replié = cet état, inchangé ; déplié = la mise en page de BASE
  // reprend (`flex-wrap: wrap`), celle que le site sert déjà partout au-dessus
  // de 640px. On ne dessine donc rien de neuf, on rend atteignable ce qui
  // existe.
  //
  // Les quinze puces restent en permanence dans le `radiogroup` : replier change
  // la forme, jamais la composition. Rien n'est retiré aux lecteurs d'écran, et
  // il n'y a aucun radio enfermé dans un conteneur fermé — c'est ce qui écarte
  // <details>, qui aurait coupé le groupe en deux.
  const [stationsOpen, setStationsOpen] = useState(false)
  const stationsRef = useRef(null)
  const chipRefs = useRef({})

  // Replié, les quinze stations sont sur un TAMBOUR — la même roue à 360° que le
  // sélecteur de sources d'actualités (`useSourceDrum`), qui boucle : après la
  // quinzième revient la première. Déplié, la roue s'éteint et rend la main à la
  // grille où les quinze s'affichent à plat. Les deux états servent deux
  // gestes : faire défiler pour écouter de proche en proche, ou tout voir d'un
  // coup pour choisir.
  //
  // `pick` est sûr comme rappel d'arrêt : il ne part qu'une fois la roue
  // immobile — jamais à chaque image — et il sort immédiatement si la station
  // visée est déjà la station courante, donc un arrêt redondant ne coupe aucun
  // flux.
  useSourceDrum({
    trackRef: stationsRef,
    itemRefs: chipRefs,
    ids: STATIONS.map((s) => s.id),
    activeId: stationId,
    onSettle: pick,
    enabled: !stationsOpen,
  })

  // Quand la rangée défile (repli sans JavaScript, ou au-dessus de 640px si
  // elle déborde), on amène la puce active dans le champ : sinon quelqu'un qui
  // écoute la quinzième station verrait les deux premières et se croirait
  // ailleurs.
  //
  // ON ÉCRIT `scrollLeft` À LA MAIN, ET SURTOUT PAS `scrollIntoView`.
  // `scrollIntoView` fait défiler TOUS les ancêtres défilables, document
  // compris ; `block: 'nearest'` n'est inerte que si l'élément est DÉJÀ
  // visible, ce qui n'est jamais le cas au montage puisque la console est sous
  // le pli. Avec `html { scroll-behavior: smooth }`, la page glissait donc
  // toute seule par-dessus le héros jusqu'aux puces, à chaque chargement, sur
  // les douze pages. Mesuré : scrollY 0 → 485px en une seconde à 900px de
  // large. Écrire `scrollLeft` sur la piste ne peut, par construction, bouger
  // qu'elle.
  useEffect(() => {
    const piste = stationsRef.current
    if (stationsOpen || !piste || piste.classList.contains('is-drum')) return
    const puce = piste.querySelector('.radio__chip.is-active')
    if (!puce) return
    piste.scrollLeft = puce.offsetLeft - (piste.clientWidth - puce.offsetWidth) / 2
  }, [stationId, stationsOpen])

  return (
    <section className="section radio-section" id="direct">
      <div className="container">
        <SectionHead
          eyebrow={t('radio.eyebrow')}
          title={t('radio.title')}
          subtitle={t('radio.subtitle')}
        />

        <div className="radio reveal">
          <div className="radio__console">
            <button
              type="button"
              className={`radio__play${playing ? ' is-playing' : ''}`}
              onClick={toggle}
              aria-pressed={playing}
              aria-label={playing ? t('radio.pause') : t('radio.play')}
            >
              <span className="radio__play-glyph" aria-hidden="true">
                {playing ? '❚❚' : '▶'}
              </span>
            </button>

            <div className="radio__body">
              <div className="radio__meta">
                <span
                  className={`radio__onair${playing ? ' is-live' : ''}`}
                  aria-live="polite"
                >
                  <span className="radio__dot" aria-hidden="true" />
                  {t('radio.onair')}
                </span>
                <span className="radio__now">{stationName(stationId)}</span>
                {time && (
                  <span className="radio__clock">
                    {t('radio.tz')} {time}
                  </span>
                )}
              </div>

              <canvas
                className="radio__viz"
                ref={canvasRef}
                aria-hidden="true"
              />

              <div className="radio__status" role="status">
                {error
                  ? t('radio.error')
                  : loading
                    ? t('radio.loading')
                    : playing
                      ? `${t('radio.onair')} · ${stationName(stationId)}`
                      : t('radio.play')}
                {error && (
                  <button type="button" className="radio__retry" onClick={play}>
                    {t('radio.retry')}
                  </button>
                )}
              </div>
            </div>

            <label className="radio__volume">
              <span className="radio__volume-icon" aria-hidden="true">
                ♪
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                aria-label={t('radio.volume')}
              />
            </label>
          </div>

          <div
            ref={stationsRef}
            className={`radio__stations${stationsOpen ? ' is-open' : ''}`}
            role="radiogroup"
            aria-label={t('radio.station')}
          >
            {/* Une station hors antenne garde sa puce, son rang et sa place
                dans le groupe : elle est inerte, pas absente.

                ON EMPLOIE `aria-disabled`, JAMAIS L'ATTRIBUT `disabled`. Un
                bouton `disabled` sort du parcours de tabulation : la puce
                deviendrait infocusable, donc invisible au clavier et aux
                lecteurs d'écran, et personne n'apprendrait POURQUOI la station
                ne joue pas. C'est le même piège que celui déjà payé sur le
                tambour, où `visibility: hidden` retirait deux onglets de
                l'arbre d'accessibilité et tuait la navigation clavier.
                `aria-disabled` annonce l'état sans retirer l'élément ; c'est
                `pick` qui refuse la sélection. */}
            {STATIONS.map((s) => (
              <button
                key={s.id}
                ref={(el) => (chipRefs.current[s.id] = el)}
                type="button"
                className={`radio__chip${s.id === stationId ? ' is-active' : ''}${
                  s.offAir ? ' is-offair' : ''
                }`}
                role="radio"
                aria-checked={s.id === stationId}
                aria-disabled={s.offAir || undefined}
                onClick={() => pick(s.id)}
              >
                {stationName(s.id)}
                {s.offAir && (
                  <span className="radio__chip-off"> · {t('radio.offair')}</span>
                )}
              </button>
            ))}
          </div>

          {/* La bascule, HORS du radiogroup : c'est un contrôle d'affichage,
              pas un choix de station.

              LE NOMBRE VIENT DE `STATIONS.length`, jamais d'une chaîne. Le
              dépôt écrit déjà le compte en toutes lettres dans quatorze textes
              — les quatre `radio.subtitle`, les quatre `radio.more`, les
              `radio.page.*`, les descriptions de src/seo.js, les cartes de
              pages/ — parce que `t()` ne sait pas interpoler, et
              `test/radio-count.test.mjs` existe pour les empêcher de mentir
              ensemble. Écrire « quinze » dans une clé de plus ferait entrer un
              quinzième texte dans cette famille. L'injecter le rend incapable
              de mentir, et n'ajoute rien à tenir à jour. La clé ne porte donc
              que les mots.

              Le nombre entre par un GABARIT `{n}` et non par une
              concaténation : « Voir les 12 stations », « Показать все 12
              радиостанций », « Տեսնել 12 ռադիոկայանները » ne placent pas le
              chiffre au même endroit, et coller un nombre au bout d'une chaîne
              donnerait une phrase fausse dans au moins deux des quatre langues. */}
          <button
            type="button"
            className="radio__stations-toggle"
            aria-expanded={stationsOpen}
            onClick={() => setStationsOpen((v) => !v)}
          >
            {stationsOpen
              ? t('radio.stations.less')
              : t('radio.stations.all').replace('{n}', STATIONS.length)}
            <span aria-hidden="true">{stationsOpen ? ' ⌃' : ' ⌄'}</span>
          </button>
        </div>

        {/* CORS element: crossOrigin lets the analyser read the stream (spectrum) */}
        <audio ref={audioRef} crossOrigin="anonymous" preload="none" />
        {/* Plain element: no crossOrigin, never fed to Web Audio, for CORS-less
            streams (e.g. Voice of Van) that would otherwise fail or be muted. */}
        <audio ref={plainAudioRef} preload="none" />

        {/* Le lien qui dit à Google laquelle des deux pages traite le sujet en
            profondeur. Son TEXTE porte la requête — « En savoir plus » ne dirait
            rien de la page visée. Absent de /radio/ : voir `more` ci-dessus. */}
        {more && (
          <p className="section__more">
            <a href={pathFor(lang, 'radio')}>
              {t('radio.more')} <span aria-hidden="true">→</span>
            </a>
          </p>
        )}
      </div>
    </section>
  )
}
