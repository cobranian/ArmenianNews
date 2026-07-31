import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { applyMeta } from './scripts/lib/site-meta.mjs'
import { AGENDA_LD_ATTR, AGENDA_LD_VALUE } from './scripts/lib/agenda-ld.mjs'
import { evenementComplet } from './src/agendaEvents.js'
import { primaryLang } from './sites.config.js'

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
      // Le même filtre que la vue /agenda/ et que `npm run check` : écrit une
      // seule fois (src/agendaEvents.js), sinon les trois divergent sur la même
      // liste d'événements.
      const events = [...(agenda.switzerland || []), ...(agenda.world || [])]
        .filter(evenementComplet)
        .map((e) => {
          const node = {
            '@type': 'Event',
            name: e.title,
            startDate: e.date,
            url: e.url,
            eventStatus: 'https://schema.org/EventScheduled',
          }
          if (e.location) {
            node.location = { '@type': 'Place', name: e.location, address: e.location }
          }
          if (e.image) node.image = e.image
          return node
        })
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

export default defineConfig({
  base,
  plugins: [react(), siteMeta(), agendaEventsJsonLd()],
})
