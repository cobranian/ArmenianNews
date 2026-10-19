// IndexNow : prévenir Bing (et Yandex, Seznam, Naver — le protocole est
// partagé) des pages nouvelles ou changées, sans attendre qu'il relise le
// sitemap.
//
// Pourquoi : Bing Webmaster Tools donne au .ch un quota de soumission manuelle
// de ZÉRO URL par jour (mesuré le 19 octobre 2026 ; 100 pour le .org). IndexNow
// n'a pas ce quota. La clé n'est pas un secret : elle est servie en clair
// (public/<clé>.txt, donc sur les DEUX vitrines) et c'est ce fichier qui prouve
// la propriété de l'hôte. Renommer ou supprimer ce fichier rend toutes les
// soumissions « 403 key not valid », sans que rien d'autre ne casse.
//
// Fonctions pures ici, réseau dans scripts/indexnow.mjs.
export const INDEXNOW_KEY = '71f5b2da313e0e3a62ea331d17612a02'
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

// { url → lastmod } depuis un sitemap.xml. Lecture par regex, suffisante pour
// les sitemaps que ce dépôt écrit lui-même (scripts/lib/sitemap.mjs).
export function parseSitemap(xml) {
  const out = new Map()
  for (const m of String(xml ?? '').matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = m[1].match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim()
    if (!loc) continue
    out.set(loc, m[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim() ?? '')
  }
  return out
}

// Les URL à soumettre : celles absentes du sitemap en ligne, et celles dont le
// JOUR de lastmod a changé. Au jour, pas à la seconde : les accueils et vues
// portent l'heure du dernier scrape, donc une comparaison exacte les
// soumettrait toutes les heures — IndexNow demande de ne soumettre que ce qui
// a changé, et un envoi horaire de seize URL identiques passe pour du bruit.
// Au jour, elles partent une fois par jour, au premier instantané.
//
// `before` vide (sitemap en ligne illisible) : on ne soumet RIEN plutôt que
// tout — un hoquet réseau ne doit pas déclencher un envoi massif.
export function urlsToSubmit(before, after) {
  if (!before?.size) return []
  const day = (s) => String(s ?? '').slice(0, 10)
  return [...after].filter(([url, lastmod]) => !before.has(url) || day(before.get(url)) !== day(lastmod))
    .map(([url]) => url)
}

// Corps de la requête, un par hôte : IndexNow refuse un lot qui mêle des hôtes.
export function payloadFor(host, urls, key = INDEXNOW_KEY) {
  const h = new URL(host).host
  const foreign = urls.filter((u) => new URL(u).host !== h)
  if (foreign.length) throw new Error(`URL hors de ${h} : ${foreign.join(', ')}`)
  return { host: h, key, keyLocation: `https://${h}/${key}.txt`, urlList: urls }
}
