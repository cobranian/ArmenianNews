import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Firebase Hosting serves from the domain root.
// Override with BASE_PATH env if deploying under a subpath.
const base = process.env.BASE_PATH ?? '/'

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
  plugins: [react(), agendaEventsJsonLd()],
})
