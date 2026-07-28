import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { applyMeta } from './scripts/lib/site-meta.mjs'
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
      const events = [...(agenda.switzerland || []), ...(agenda.world || [])]
        .filter((e) => e.title && e.date && e.url)
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
          attrs: { type: 'application/ld+json' },
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
