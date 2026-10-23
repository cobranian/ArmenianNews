import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { applyMeta } from './scripts/lib/site-meta.mjs'
import { AGENDA_LD_ATTR, AGENDA_LD_VALUE } from './scripts/lib/agenda-ld.mjs'
import { evenementComplet, eventLd } from './src/agendaEvents.js'
import { SITES, primaryLang } from './sites.config.js'
import { accountsOnly, newsForLangs } from './scripts/lib/light-data.mjs'
import { TAB_ORDER } from './src/newsSources.js'
import { contentLang } from './src/newsLangs.js'
import { loadCulture } from './scripts/lib/culture-load.mjs'
import { teaserFor } from './scripts/lib/culture-links.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Firebase Hosting serves from the domain root.
// Override with BASE_PATH env if deploying under a subpath.
const base = process.env.BASE_PATH ?? '/'

// Quelle vitrine ce build produit. scripts/build-sites.mjs lance un build par
// site avec SITE_ID posé ; `npm run dev` n'en pose aucun et travaille donc sur
// le .ch, la vitrine française.
const SITE_ID = process.env.SITE_ID ?? 'ch'

// Injecte le <head> propre à (site, langue par défaut du site). Les pages /hy/
// et /ru/ ne passent pas par ici : elles sont dérivées après le build par
// scripts/build-sites.mjs, avec le même générateur.
function siteMeta() {
  return {
    name: 'site-meta',
    transformIndexHtml(html) {
      return applyMeta(html, { siteId: SITE_ID, lang: primaryLang(SITE_ID) })
    },
  }
}

// Build-time schema.org Event markup from the current agenda snapshot. Injected
// as static JSON-LD so crawlers see the events without executing JS, and it is
// refreshed on every hourly build (agenda.json is current at build time).
// The events are third-party (armenopole), so we do NOT claim an organizer.
//
// Le bloc est MARQUÉ (data-ld="agenda"). Il est injecté hors des sentinelles
// SITE_META, donc scripts/build-sites.mjs le recopie dans toutes les pages
// dérivées : c'est ce marqueur qui lui permet de le retirer des pages de vue,
// où l'agenda n'est pas rendu. Voir scripts/lib/agenda-ld.mjs.
function agendaEventsJsonLd() {
  return {
    name: 'agenda-events-jsonld',
    transformIndexHtml() {
      let agenda
      try {
        agenda = JSON.parse(readFileSync(join(__dirname, 'src/data/agenda.json'), 'utf-8'))
      } catch {
        return // no snapshot yet — inject nothing
      }
      // Le même filtre que la vue /agenda/ et que `npm run check`, et le MÊME
      // nœud Event que la vue : tous deux écrits une seule fois
      // (src/agendaEvents.js), sinon les pages divergent sur la même liste
      // d'événements — c'est arrivé (lieu adressé ici, pas là).
      const events = [...(agenda.switzerland || []), ...(agenda.world || [])]
        .filter(evenementComplet)
        .map(eventLd)
      if (!events.length) return
      const jsonld = { '@context': 'https://schema.org', '@graph': events }
      return [
        {
          tag: 'script',
          attrs: { type: 'application/ld+json', [AGENDA_LD_ATTR]: AGENDA_LD_VALUE },
          // Escape "<" so a scraped title containing "</script>" can't break out.
          children: JSON.stringify(jsonld).replace(/</g, '\\u003c'),
          injectTo: 'head',
        },
      ]
    },
  }
}

// Allège au build les deux JSON que les composants importent en entier alors
// qu'ils n'en lisent qu'une part (scripts/lib/light-data.mjs dit laquelle et
// pourquoi). Le hook `load` remplace le CONTENU du fichier pour le bundle ;
// le fichier sur disque, lui, ne change pas — le scraper, les tests et le
// prérendu continuent de lire le vrai news.json et le vrai pool.
//
//   src/data/news.json       → les seules langues que cette vitrine sert
//   src/data/instagram.json  → les comptes, sans leurs posts
//
// `enforce: 'pre'` pour passer avant le chargeur de fichiers de Vite ; les ids
// sont comparés sur leur fin de chemin, parce que Vite les absolutise.
function lightData() {
  // de/it lisent le fil français : c'est la langue de CONTENU qu'on embarque.
  const langs = [...new Set(SITES[SITE_ID].pages.map((p) => contentLang(p.lang)))]
  const ends = (id, rel) => id.replace(/\\/g, '/').endsWith(rel)
  return {
    name: 'light-data',
    enforce: 'pre',
    load(id) {
      if (ends(id, '/src/data/news.json')) {
        const news = JSON.parse(readFileSync(join(__dirname, 'src/data/news.json'), 'utf-8'))
        return JSON.stringify(newsForLangs(news, langs, TAB_ORDER))
      }
      if (ends(id, '/src/data/instagram.json')) {
        const pool = JSON.parse(readFileSync(join(__dirname, 'src/data/instagram.json'), 'utf-8'))
        return JSON.stringify(accountsOnly(pool))
      }
      return null
    },
  }
}

// Le carrousel Culture de l'accueil : les 12 derniers articles Culture de
// chaque langue de CETTE vitrine — titre, description et présence d'une image
// (un booléen : le carrousel pose lui-même le chemin), comme lightData()
// n'embarque que les langues servies. Les avertissements d'un
// article invalide sont déjà écrits par build-sites.mjs : ici, silence.
function cultureTeaser() {
  const ID = 'virtual:culture-teaser'
  const langs = SITES[SITE_ID].pages.map((p) => p.lang)
  return {
    name: 'culture-teaser',
    resolveId(id) {
      return id === ID ? `\0${ID}` : null
    },
    async load(id) {
      if (id !== `\0${ID}`) return null
      const articles = await loadCulture(join(__dirname, 'src/data/culture'), { warn: () => {} })
      return `export default ${JSON.stringify(teaserFor(articles, langs, 12))}`
    },
  }
}

export default defineConfig({
  base,
  plugins: [react(), lightData(), cultureTeaser(), siteMeta(), agendaEventsJsonLd()],
})
