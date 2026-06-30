import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// Supported interface languages. Content (articles, posts) stays in its
// original language; only the chrome is translated.
export const LANGS = [
  { code: 'fr', label: 'FR', name: 'Francais' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'hy', label: 'ՀԱՅ', name: 'Հայերեն' },
]

const STRINGS = {
  fr: {
    'site.title': 'Arménie Info',
    'site.tagline': "Un instantane quotidien de l'Armenie et de sa diaspora",
    'site.snapshot': 'Instantane du',

    'nav.news': 'Actualites',
    'nav.agenda': 'Agenda',
    'nav.facebook': 'Don Narek',
    'nav.instagram': 'Instagram',

    'news.title': 'Actualites',
    'news.subtitle': "La derniere publication de chaque rubrique du Courrier d'Erevan",
    'news.armradio': "En direct d'Armenie · Public Radio of Armenia",
    'news.readmore': 'Lire la suite',
    'news.source': 'Source',
    'news.empty': 'Aucun article pour le moment.',

    'agenda.title': 'Agenda',
    'agenda.subtitle': 'Evenements armeniens en Suisse et dans le monde',
    'agenda.switzerland': 'Suisse',
    'agenda.world': 'Monde',
    'agenda.recurring': 'Rendez-vous hebdomadaires',
    'agenda.empty': 'Aucun evenement annonce.',
    'agenda.more': "Voir sur armenopole",

    'fb.title': 'Don Narek',
    'fb.subtitle': 'Les dernieres publications de la page Facebook',
    'fb.fallback': 'Voir la page sur Facebook',

    'ig.title': 'Instagram',
    'ig.subtitle': "Une mosaïque d'inspiration arménienne, au hasard",
    'ig.shuffle': 'Melanger',
    'ig.visit': 'Voir le profil',
    'ig.view': 'Voir sur Instagram',

    'footer.built': "Instantane statique · sources liees a leurs sites d'origine",
    'footer.sources': 'Sources',

    'sections.actualite': 'Actualites',
    'sections.societe': 'Societe',
    'sections.economie': 'Economie',
    'sections.arts-et-culture': 'Arts et culture',
    'sections.francophonie': 'Armenie francophone',
    'sections.opinions': 'Opinions',
    'sections.region': 'Region',
    'sections.diasporas': 'Diasporas',
  },
  en: {
    'site.title': 'Armenia Info',
    'site.tagline': 'A daily snapshot of Armenia and its diaspora',
    'site.snapshot': 'Snapshot of',

    'nav.news': 'News',
    'nav.agenda': 'Events',
    'nav.facebook': 'Don Narek',
    'nav.instagram': 'Instagram',

    'news.title': 'News',
    'news.subtitle': "The latest story from each section of Le Courrier d'Erevan",
    'news.armradio': 'Live from Armenia · Public Radio of Armenia',
    'news.readmore': 'Read more',
    'news.source': 'Source',
    'news.empty': 'No articles yet.',

    'agenda.title': 'Events',
    'agenda.subtitle': 'Armenian events in Switzerland and around the world',
    'agenda.switzerland': 'Switzerland',
    'agenda.world': 'World',
    'agenda.recurring': 'Weekly gatherings',
    'agenda.empty': 'No events announced.',
    'agenda.more': 'See on armenopole',

    'fb.title': 'Don Narek',
    'fb.subtitle': 'The latest posts from the Facebook page',
    'fb.fallback': 'View the page on Facebook',

    'ig.title': 'Instagram',
    'ig.subtitle': 'A mosaic of Armenian inspiration, at random',
    'ig.shuffle': 'Shuffle',
    'ig.visit': 'View profile',
    'ig.view': 'View on Instagram',

    'footer.built': 'Static snapshot · sources linked to their original sites',
    'footer.sources': 'Sources',

    'sections.actualite': 'News',
    'sections.societe': 'Society',
    'sections.economie': 'Economy',
    'sections.arts-et-culture': 'Arts & Culture',
    'sections.francophonie': 'Francophone Armenia',
    'sections.opinions': 'Opinions',
    'sections.region': 'Region',
    'sections.diasporas': 'Diasporas',
  },
  hy: {
    'site.title': 'Արմենիա Ինֆո',
    'site.tagline': 'Հայաստանի եւ սփյուռքի ամենօրյա պատկերը',
    'site.snapshot': 'Պատկեր՝',

    'nav.news': 'Լուրեր',
    'nav.agenda': 'Միջոցառումներ',
    'nav.facebook': 'Տօն Նարեկ',
    'nav.instagram': 'Instagram',

    'news.title': 'Լուրեր',
    'news.subtitle': '«Կուրիեր» թերթի յուրաքանչյուր բաժնի վերջին հրապարակումը',
    'news.armradio': 'Ուղիղ Հայաստանից · Հանրային ռադիո',
    'news.readmore': 'Կարդալ ավելին',
    'news.source': 'Աղբյուր',
    'news.empty': 'Դեռ հոդվածներ չկան։',

    'agenda.title': 'Միջոցառումներ',
    'agenda.subtitle': 'Հայկական միջոցառումներ Շվեյցարիայում եւ աշխարհում',
    'agenda.switzerland': 'Շվեյցարիա',
    'agenda.world': 'Աշխարհ',
    'agenda.recurring': 'Շաբաթական հանդիպումներ',
    'agenda.empty': 'Հայտարարված միջոցառումներ չկան։',
    'agenda.more': 'Տեսնել armenopole-ում',

    'fb.title': 'Տօն Նարեկ',
    'fb.subtitle': 'Facebook էջի վերջին հրապարակումները',
    'fb.fallback': 'Դիտել էջը Facebook-ում',

    'ig.title': 'Instagram',
    'ig.subtitle': 'Հայկական ոգեշնչման խճանկար՝ պատահական',
    'ig.shuffle': 'Խառնել',
    'ig.visit': 'Դիտել պրոֆիլը',
    'ig.view': 'Դիտել Instagram-ում',

    'footer.built': 'Ստատիկ պատկեր · աղբյուրները կապված են իրենց կայքերին',
    'footer.sources': 'Աղբյուրներ',

    'sections.actualite': 'Լուրեր',
    'sections.societe': 'Հասարակություն',
    'sections.economie': 'Տնտեսություն',
    'sections.arts-et-culture': 'Արվեստ եւ մշակույթ',
    'sections.francophonie': 'Ֆրանսախոս Հայաստան',
    'sections.opinions': 'Կարծիքներ',
    'sections.region': 'Տարածաշրջան',
    'sections.diasporas': 'Սփյուռք',
  },
}

const LOCALES = { fr: 'fr-FR', en: 'en-GB', hy: 'hy-AM' }

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const stored = typeof localStorage !== 'undefined' && localStorage.getItem('lang')
    return LANGS.some((l) => l.code === stored) ? stored : 'fr'
  })

  useEffect(() => {
    try {
      localStorage.setItem('lang', lang)
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo(() => {
    const t = (key) => STRINGS[lang][key] ?? STRINGS.fr[key] ?? key
    const formatDate = (iso) => {
      if (!iso) return ''
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return iso
      return d.toLocaleDateString(LOCALES[lang], {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    }
    return { lang, setLang, t, formatDate, locale: LOCALES[lang] }
  }, [lang])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useI18n() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider')
  return ctx
}
