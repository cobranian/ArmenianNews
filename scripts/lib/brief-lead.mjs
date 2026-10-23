// La brève du jour en tête de l'accueil de/it (BriefLead.jsx, via le module
// virtuel `virtual:brief-lead` de vite.config.js). Ces deux langues n'ont pas
// de fil propre — elles lisent le fil français (contentLang) — et la brève
// est le seul contenu écrit dans leur langue : elle passe donc avant le fil.
//
// LE PIÈGE : le bloc pointe vers la page datée de la brève. Il ne doit donc
// retenir QUE les brèves dont brief-pages.mjs bâtit la page — d'où la même
// validation (loadBriefs), pas une lecture à part : un fichier que le
// constructeur écarte (langue ou date incohérente, generatedAt absent, aucun
// sujet sourcé) donnerait sinon un lien mort en production.
//
// Ne lève JAMAIS : une brève absente ou cassée retire le bloc, elle ne doit
// pas retenir le build. Silencieux : build-sites.mjs avertit déjà.
import { briefUrl } from '../../sites.config.js'
import { loadBriefs } from './brief-pages.mjs'

const quiet = { warn: () => {} }

export async function latestBrief(dir, lang) {
  try {
    const b = (await loadBriefs(dir, quiet, [lang]))[lang][0]
    if (!b) return null
    return {
      date: b.date,
      url: briefUrl(lang, b.date),
      intro: typeof b.intro === 'string' ? b.intro : '',
      topics: b.topics.slice(0, 3).map((t) => ({ title: t.title })),
    }
  } catch {
    return null
  }
}
