// npm run radio-check — les douze flux radio diffusent-ils vraiment ?
//
// POURQUOI CE SCRIPT EXISTE. Un flux qui meurt chez son hébergeur ne fait
// échouer NI test, NI lint, NI build : le dépôt ne contient qu'une URL, et une
// URL reste une chaîne valide longtemps après que la station s'est tue. Le
// premier signalement vient d'un lecteur qui clique sur une puce et n'entend
// rien. C'est arrivé le 10 août 2026 avec Im Radio, muette depuis on ne sait
// quand. Ce script est le seul endroit d'où cette panne se voit.
//
// IL N'EST PAS DANS `npm test`, ET C'EST DÉLIBÉRÉ. Les 174 tests du dépôt ne
// touchent jamais le réseau — c'est ce qui les rend rapides et sûrs en CI. Un
// contrôle qui dépend de douze hébergeurs tiers échouerait sur un hoquet
// réseau, sur une IP de datacenter bloquée (Voice of Van refuse les IP de CI,
// voir Radio.jsx), ou pendant la maintenance nocturne d'une régie à Erevan —
// et un test qui échoue pour des raisons étrangères au dépôt finit par être
// ignoré, puis désactivé. C'est un outil qu'on lance à la main, depuis une IP
// résidentielle, comme `npm run ig-scrape`.
//
// CE QU'IL VÉRIFIE, ET DANS LES DEUX SENS. Il ne demande pas « le flux
// répond-il » mais « le flux est-il conforme à ce que le dépôt en dit » :
//
//   - une station muette qui n'est PAS marquée `offAir`  → panne à traiter ;
//   - une station marquée `offAir` qui DIFFUSE à nouveau → drapeau à retirer.
//
// Le second sens est celui qu'on oublie d'écrire, et c'est pourtant lui qui
// ferme la boucle : sans lui, une station marquée hors antenne le resterait
// pour toujours, inerte sur le site longtemps après son retour, sans que rien
// ne le rappelle.
//
// LE VERDICT NE SE LIT PAS DANS LE CODE HTTP, MAIS DANS LES OCTETS. Un
// Shoutcast sans encodeur répond `401 The resource requested is currently
// unavailable` — mais tous ne le font pas, et un proxy Cloudflare devant un
// flux mort peut très bien répondre 200 avec un corps vide. On attend donc le
// PREMIER OCTET d'audio, puis on raccroche : c'est la seule preuve qu'il y a
// quelque chose à écouter. Un `content-type` ne prouve rien — il décrit ce que
// le serveur promet d'envoyer, pas ce qu'il envoie.
//
// ON PARLE AU SERVEUR SUR UNE SOCKET NUE, SANS CLIENT HTTP. Ni `fetch`, ni
// `node:https`, et ce n'est pas une préférence de style : LA MOITIÉ DE CES
// SERVEURS NE PARLENT PAS HTTP.
//
//   $ openssl s_client -connect vovan.s3ming.com:443 …
//   ICY 200 OK
//   icy-name:Voice Of Van
//   content-type:audio/mpeg
//
// « ICY 200 OK » est la ligne de statut de Shoutcast v1, antérieure à la
// normalisation HTTP. Le parseur de Node la REFUSE (`HPE_INVALID_CONSTANT`), et
// curl échoue pareil — la première version de ce script déclarait donc Voice of
// Van en panne alors qu'elle diffusait parfaitement. Un outil de détection qui
// crie au loup est pire que pas d'outil : on cesse de le lancer.
//
// On écrit donc la requête à la main et on lit la première ligne soi-même, en
// acceptant les deux dialectes. C'est aussi ce qui permet de raccrocher au
// premier octet sur un flux infini.
//
// (Le détour par undici documenté dans `fetchTextNode` — 403 contre 200 — ne se
// pose pas ici : aucun client HTTP n'est employé.)

import net from 'node:net'
import tls from 'node:tls'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const TIMEOUT = 12000 // large : une régie lointaine peut mettre du temps
const CONCURRENCE = 4

// --- Lecture du tableau STATIONS -------------------------------------------
//
// On lit Radio.jsx comme du TEXTE. Node ne sait pas importer du JSX
// (ERR_UNKNOWN_FILE_EXTENSION) — même contrainte que
// test/radio-count.test.mjs, et la même raison qui a fait sortir LANGS de
// i18n.jsx vers sites.config.js.
//
// Trois stations passent par une constante (`MARIAM_PROXY`, `VOV_STREAM`,
// `YERAZ_PROXY`) déclarée au-dessus du tableau : on les résout, sinon le
// contrôle sauterait en silence les trois flux les plus fragiles du lot — ceux
// qui dépendent d'un Worker Cloudflare que personne ne redéploie jamais.
function lireStations() {
  const src = readFileSync(path.join(root, 'src/components/Radio.jsx'), 'utf-8')

  const constantes = new Map()
  for (const m of src.matchAll(/^const ([A-Z_][A-Z0-9_]*) = '([^']+)'/gm)) {
    constantes.set(m[1], m[2])
  }

  const bloc = src.match(/const STATIONS = \[[\s\S]*?\n\]/)
  if (!bloc) throw new Error('tableau STATIONS introuvable dans Radio.jsx')

  const stations = []
  for (const m of bloc[0].matchAll(/\{\s*id:\s*'([^']+)'[^}]*\}/g)) {
    const entree = m[0]
    const flux = entree.match(/stream:\s*(?:'([^']+)'|([A-Z_][A-Z0-9_]*))/)
    if (!flux) throw new Error(`station « ${m[1]} » sans flux lisible`)
    const url = flux[1] ?? constantes.get(flux[2])
    if (!url) throw new Error(`constante « ${flux[2]} » introuvable dans Radio.jsx`)
    stations.push({ id: m[1], url, offAir: /offAir:\s*true/.test(entree) })
  }
  if (!stations.length) throw new Error('aucune station lue dans STATIONS')
  return stations
}

// --- Sonde ------------------------------------------------------------------
//
// Résout { vivant, detail }. Ne rejette jamais : une panne réseau est un
// résultat, pas une exception — le rapport doit rester complet même si trois
// hôtes sont injoignables.
function sonder(url, sauts = 0) {
  return new Promise((resolve) => {
    let cible
    try {
      cible = new URL(url)
    } catch {
      return resolve({ vivant: false, detail: 'URL illisible' })
    }

    let fini = false
    let socket = null
    const finir = (vivant, detail) => {
      if (fini) return
      fini = true
      clearTimeout(minuteur)
      socket?.destroy()
      resolve({ vivant, detail })
    }

    const minuteur = setTimeout(
      () => finir(false, `aucune réponse en ${TIMEOUT / 1000} s`),
      TIMEOUT,
    )

    const sur = cible.protocol === 'https:'
    const port = cible.port || (sur ? 443 : 80)
    const options = { host: cible.hostname, port }
    socket = sur
      ? tls.connect({ ...options, servername: cible.hostname })
      : net.connect(options)

    socket.on('error', (err) => finir(false, err.code || err.message))

    socket.on(sur ? 'secureConnect' : 'connect', () => {
      // HTTP/1.0 volontairement : il n'a ni « chunked » ni connexions
      // persistantes à démêler, et tous les Shoutcast le comprennent. On ne
      // lit de toute façon que les en-têtes et le premier octet.
      //
      // `Icy-MetaData: 1` fait annoncer au serveur son nom et son débit dans
      // ses en-têtes — la même mesure que celle qui source le champ `bitrate`
      // de src/stations.js.
      socket.write(
        `GET ${cible.pathname}${cible.search} HTTP/1.0\r\n` +
          `Host: ${cible.host}\r\n` +
          `User-Agent: ${UA}\r\n` +
          'Accept: */*\r\n' +
          'Icy-MetaData: 1\r\n' +
          'Connection: close\r\n\r\n',
      )
    })

    let tete = ''
    let resume = ''
    let entetesLues = false

    socket.on('data', (bloc) => {
      // Une fois les en-têtes passées, le moindre octet est la preuve
      // recherchée : il y a bien de l'audio au bout du fil.
      if (entetesLues) return finir(true, resume)

      tete += bloc.toString('latin1')
      const coupure = tete.indexOf('\r\n\r\n')
      if (coupure === -1) {
        // Un serveur qui n'en finit pas d'envoyer des en-têtes n'en enverra
        // jamais d'audio ; on ne mémorise pas indéfiniment.
        if (tete.length > 16384) finir(false, 'en-têtes interminables')
        return
      }

      const lignes = tete.slice(0, coupure).split('\r\n')
      // LA LIGNE DE STATUT A DEUX FORMES : « HTTP/1.x 200 OK » et, sur les
      // Shoutcast v1, « ICY 200 OK ». On prend le premier nombre à trois
      // chiffres, ce qui couvre les deux sans les distinguer.
      const code = Number(lignes[0].match(/\b(\d{3})\b/)?.[1])
      const entetes = new Map(
        lignes.slice(1).map((l) => {
          const i = l.indexOf(':')
          return [l.slice(0, i).trim().toLowerCase(), l.slice(i + 1).trim()]
        }),
      )

      if (!code) return finir(false, `réponse illisible : ${lignes[0].slice(0, 60)}`)

      // Un flux peut légitimement rediriger (Armenian Gospel Radio le fait
      // depuis sa forme en chemin). On suit, mais pas en rond.
      const lieu = entetes.get('location')
      if (code >= 300 && code < 400 && lieu && sauts < 3) {
        fini = true
        clearTimeout(minuteur)
        socket.destroy()
        return resolve(sonder(new URL(lieu, cible).href, sauts + 1))
      }

      if (code !== 200 && code !== 206) {
        // Le DNAS Shoutcast dit lui-même pourquoi, et sa phrase est la plus
        // utile du rapport : « The resource requested is currently
        // unavailable » = le compte existe, aucun encodeur n'y est connecté.
        const note = entetes.get('icy-notice2')
        return finir(false, `HTTP ${code}${note ? ` — ${note.replace(/<BR>/gi, '')}` : ''}`)
      }

      const debit = entetes.get('icy-br')
      resume =
        [entetes.get('icy-name'), debit ? `${debit} kbps` : null].filter(Boolean).join(' · ') ||
        `HTTP ${code}`

      entetesLues = true
      // Les en-têtes et les premiers octets arrivent souvent dans le MÊME
      // paquet : sans ce test, on attendrait un second envoi qui peut ne
      // jamais venir, et une station vivante passerait pour muette.
      if (tete.length > coupure + 4) finir(true, resume)
    })

    // Fin de connexion sans le moindre octet d'audio : le serveur a répondu,
    // il n'a rien à diffuser.
    socket.on('close', () =>
      finir(false, entetesLues ? "zéro octet d'audio après les en-têtes" : 'connexion coupée'),
    )
  })
}

// --- Rapport ----------------------------------------------------------------

const SIGNES = { ok: '  ok  ', panne: ' PANNE', retour: 'RETOUR', prevu: ' prévu' }

async function main() {
  const stations = lireStations()
  console.log(`\nContrôle des ${stations.length} flux radio…\n`)

  const resultats = []
  let curseur = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCE, stations.length) }, async () => {
      while (curseur < stations.length) {
        const s = stations[curseur++]
        resultats.push({ ...s, ...(await sonder(s.url)) })
      }
    }),
  )
  resultats.sort(
    (a, b) => stations.findIndex((s) => s.id === a.id) - stations.findIndex((s) => s.id === b.id),
  )

  const aCorriger = []
  for (const r of resultats) {
    let etat
    if (r.vivant && !r.offAir) etat = 'ok'
    else if (!r.vivant && r.offAir) etat = 'prevu'
    else if (!r.vivant) {
      etat = 'panne'
      aCorriger.push(`${r.id} : muette et NON marquée — ${r.detail}`)
    } else {
      etat = 'retour'
      aCorriger.push(`${r.id} : rediffuse — retirer son « offAir: true » dans Radio.jsx`)
    }
    console.log(`[${SIGNES[etat]}] ${r.id.padEnd(15)} ${r.detail}`)
  }

  if (!aCorriger.length) {
    console.log(`\nLes ${resultats.length} flux sont conformes à ce que le dépôt en dit.\n`)
    return
  }

  // Le message nomme le fichier ET le geste : un rapport qui dit seulement
  // « échec » fait rouvrir l'enquête depuis zéro à chaque fois.
  console.log('\nÀ traiter :')
  for (const ligne of aCorriger) console.log(`  · ${ligne}`)
  console.log(
    '\nUne station muette se marque « offAir: true » dans le tableau STATIONS de\n' +
      "src/components/Radio.jsx : sa puce devient inerte et porte « hors antenne »,\n" +
      'sans toucher au compte de douze écrit en toutes lettres dans quatorze textes.\n',
  )
  process.exitCode = 1
}

main().catch((err) => {
  console.error(`\nradio-check a échoué : ${err.message}\n`)
  process.exitCode = 1
})
