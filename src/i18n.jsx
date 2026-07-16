import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// Supported interface languages. Content (articles, posts) stays in its
// original language; only the chrome is translated.
export const LANGS = [
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'hy', label: 'ՀԱՅ', name: 'Հայերեն' },
]

const STRINGS = {
  fr: {
    'site.title': 'Arménie Info',
    'site.tagline': 'Un instantané horaire de la vie arménienne, de Suisse et du monde',
    'site.snapshot': 'Instantané du',

    'nav.news': 'Actualités',
    'nav.radio': 'En direct',
    'nav.agenda': 'Agenda',
    'nav.social': 'Réseaux',

    'news.title': 'Actualités',
    'news.subtitle': "Les dernières publications de chaque rubrique du Courrier d'Erevan",
    'news.armradio': "En direct d'Arménie · Public Radio of Armenia",
    'news.readmore': 'Lire la suite',
    'news.prev': 'Précédent',
    'news.next': 'Suivant',
    'news.source': 'Source',
    'news.empty': 'Aucun article pour le moment.',

    'agenda.title': 'Agenda',
    'agenda.subtitle': 'Événements arméniens en Suisse et dans le monde',
    'agenda.switzerland': 'Suisse',
    'agenda.world': 'Monde',
    'agenda.empty': 'Aucun événement annoncé.',
    'agenda.more': "Voir sur armenopole",

    'social.title': 'Réseaux sociaux',
    'social.subtitle':
      "Deux fils : l'art que partage Don Narek sur Facebook, et une sélection Instagram retirée au sort chaque heure",

    'fb.title': 'Art arménien',
    'fb.by': 'par Don Narek',
    'fb.subtitle': 'Les 20 dernières publications, en images',
    'fb.view': 'Voir la publication',
    'fb.fallback': 'Voir la page sur Facebook',

    'ig.title': 'Instagram',
    'ig.subtitle': "Une mosaïque d'inspiration arménienne, au hasard",
    'ig.strand': 'Mosaïque arménienne',
    'ig.strand.people': 'Visages arméniens',
    'ig.shuffle': 'Mélanger',
    'ig.visit': 'Voir le profil',
    'ig.view': 'Voir sur Instagram',

    'footer.built': "Instantané statique · sources liées à leurs sites d'origine",
    'footer.write': 'Écrivez-nous',
    'footer.sources': 'Sources',

    'sections.actualite': 'Actualités',
    'sections.societe': 'Société',
    'sections.economie': 'Économie',
    'sections.arts-et-culture': 'Arts et culture',
    'sections.francophonie': 'Arménie francophone',
    'sections.opinions': 'Opinions',
    'sections.region': 'Région',
    'sections.diasporas': 'Diasporas',

    'armcats.politics': 'Politique',
    'armcats.society': 'Société',
    'armcats.economics': 'Économie',
    'armcats.analytics': 'Analyses',
    'armcats.world': 'Monde',
    'armcats.culture': 'Culture',
    'armcats.sport': 'Sport',

    'namcats.actualites': 'Actualités',
    'namcats.sport': 'Sport',
    'namcats.communaute': 'Communauté',
    'namcats.culture': 'Culture',
    'namcats.lifestyle': 'Lifestyle',
    'namcats.magazine': 'Magazines',

    'azkcats.armenie-artsakh': 'Arménie & Artsakh',
    'azkcats.communaute': 'Communauté',
    'azkcats.divers': 'Divers',

    'aitcats.armenie': 'Arménie',
    'aitcats.art-culture': 'Art & Culture',
    'aitcats.artsakh': 'Artsakh',
    'aitcats.diaspora': 'Diaspora',
    'aitcats.france': 'France',
    'aitcats.geopolitique': 'Géopolitique',
    'aitcats.politique': 'Politique',
    'aitcats.un-autre-regard': 'Un autre regard',

    'browser.subtitle': 'Toutes les rubriques, source par source',
    'browser.armradio': 'Radio publique d’Arménie',
    'browser.courrier': 'Courrier d’Erevan',
    'browser.armenews': 'armenews.com',
    'browser.artzakank': 'Écho des Arméniens de Suisse',
    'browser.armenieinfotv': 'armenieinfo.tv',
    'browser.armenpress': 'Armenpress',
    'apcats.fil': 'Fil',

    'radio.eyebrow': 'Erevan · 128 kbps',
    'radio.title': 'En direct',
    'radio.subtitle': "La Radio publique d’Arménie, en flux continu",
    'radio.onair': 'En direct',
    'radio.tz': 'Erevan',
    'radio.play': 'Écouter en direct',
    'radio.pause': 'Mettre en pause',
    'radio.loading': 'Connexion au flux…',
    'radio.error': 'Flux indisponible.',
    'radio.retry': 'Réessayer',
    'radio.volume': 'Volume',
    'radio.station': 'Station',
    'radio.st.public': 'Première chaîne',
    'radio.st.im': 'Im Radio',
    'radio.st.arevik': 'Radio Arevik',
    'radio.st.culture': 'Radio Culture',
    'radio.st.mariam': 'Radio Mariam',
    'radio.st.vov': 'Voice of Van',
    'radio.st.lav': 'Lav Radio',
    'radio.st.fama': 'Radio Fama',
    'radio.st.yerevannights': 'Yerevan Nights',
    'radio.st.gospel': 'Armenian Gospel Radio',
    'radio.st.yeraz': 'Radio Yeraz',
  },
  en: {
    'site.title': 'Armenia Info',
    'site.tagline': 'A daily snapshot of Armenia and its diaspora',
    'site.snapshot': 'Snapshot of',

    'nav.news': 'News',
    'nav.radio': 'Live',
    'nav.agenda': 'Events',
    'nav.social': 'Social',

    'news.title': 'News',
    'news.subtitle': "The latest stories from each section of Le Courrier d'Erevan",
    'news.armradio': 'Live from Armenia · Public Radio of Armenia',
    'news.readmore': 'Read more',
    'news.prev': 'Previous',
    'news.next': 'Next',
    'news.source': 'Source',
    'news.empty': 'No articles yet.',

    'agenda.title': 'Events',
    'agenda.subtitle': 'Armenian events in Switzerland and around the world',
    'agenda.switzerland': 'Switzerland',
    'agenda.world': 'World',
    'agenda.empty': 'No events announced.',
    'agenda.more': 'See on armenopole',

    'social.title': 'Social networks',
    'social.subtitle':
      'Two feeds: the art Don Narek shares on Facebook, and an Instagram selection drawn afresh every hour',

    'fb.title': 'Armenian Art',
    'fb.by': 'by Don Narek',
    'fb.subtitle': 'The 20 latest posts, in pictures',
    'fb.view': 'View the post',
    'fb.fallback': 'View the page on Facebook',

    'ig.title': 'Instagram',
    'ig.subtitle': 'A mosaic of Armenian inspiration, at random',
    'ig.strand': 'Armenian mosaic',
    'ig.strand.people': 'Armenian faces',
    'ig.shuffle': 'Shuffle',
    'ig.visit': 'View profile',
    'ig.view': 'View on Instagram',

    'footer.built': 'Static snapshot · sources linked to their original sites',
    'footer.write': 'Write to us',
    'footer.sources': 'Sources',

    'sections.actualite': 'News',
    'sections.societe': 'Society',
    'sections.economie': 'Economy',
    'sections.arts-et-culture': 'Arts & Culture',
    'sections.francophonie': 'Francophone Armenia',
    'sections.opinions': 'Opinions',
    'sections.region': 'Region',
    'sections.diasporas': 'Diasporas',

    'armcats.politics': 'Politics',
    'armcats.society': 'Society',
    'armcats.economics': 'Economics',
    'armcats.analytics': 'Analytics',
    'armcats.world': 'World',
    'armcats.culture': 'Culture',
    'armcats.sport': 'Sport',

    'namcats.actualites': 'News',
    'namcats.sport': 'Sport',
    'namcats.communaute': 'Community',
    'namcats.culture': 'Culture',
    'namcats.lifestyle': 'Lifestyle',
    'namcats.magazine': 'Magazines',

    'azkcats.armenie-artsakh': 'Armenia & Artsakh',
    'azkcats.communaute': 'Community',
    'azkcats.divers': 'Miscellany',

    'aitcats.armenie': 'Armenia',
    'aitcats.art-culture': 'Art & Culture',
    'aitcats.artsakh': 'Artsakh',
    'aitcats.diaspora': 'Diaspora',
    'aitcats.france': 'France',
    'aitcats.geopolitique': 'Geopolitics',
    'aitcats.politique': 'Politics',
    'aitcats.un-autre-regard': 'Another view',

    'browser.subtitle': 'Every rubric, source by source',
    'browser.armradio': 'Public Radio of Armenia',
    'browser.courrier': 'Le Courrier d’Erevan',
    'browser.armenews': 'armenews.com',
    'browser.artzakank': 'Echo of Armenians in Switzerland',
    'browser.armenieinfotv': 'armenieinfo.tv',
    'browser.armenpress': 'Armenpress',
    'apcats.fil': 'Wire',

    'radio.eyebrow': 'Yerevan · 128 kbps',
    'radio.title': 'Live radio',
    'radio.subtitle': 'Public Radio of Armenia, streaming live',
    'radio.onair': 'On air',
    'radio.tz': 'Yerevan',
    'radio.play': 'Listen live',
    'radio.pause': 'Pause',
    'radio.loading': 'Connecting to the stream…',
    'radio.error': 'Stream unavailable.',
    'radio.retry': 'Retry',
    'radio.volume': 'Volume',
    'radio.station': 'Station',
    'radio.st.public': 'First Programme',
    'radio.st.im': 'Im Radio',
    'radio.st.arevik': 'Radio Arevik',
    'radio.st.culture': 'Radio Culture',
    'radio.st.mariam': 'Radio Mariam',
    'radio.st.vov': 'Voice of Van',
    'radio.st.lav': 'Lav Radio',
    'radio.st.fama': 'Radio Fama',
    'radio.st.yerevannights': 'Yerevan Nights',
    'radio.st.gospel': 'Armenian Gospel Radio',
    'radio.st.yeraz': 'Radio Yeraz',
  },
  hy: {
    'site.title': 'Արմենիա Ինֆո',
    'site.tagline': 'Հայաստանի եւ սփյուռքի ամենօրյա պատկերը',
    'site.snapshot': 'Պատկեր՝',

    'nav.news': 'Լուրեր',
    'nav.radio': 'Ուղիղ',
    'nav.agenda': 'Միջոցառումներ',
    'nav.social': 'Ցանցեր',

    'news.title': 'Լուրեր',
    'news.subtitle': '«Կուրիեր» թերթի յուրաքանչյուր բաժնի վերջին հրապարակումները',
    'news.armradio': 'Ուղիղ Հայաստանից · Հանրային ռադիո',
    'news.readmore': 'Կարդալ ավելին',
    'news.prev': 'Նախորդ',
    'news.next': 'Հաջորդ',
    'news.source': 'Աղբյուր',
    'news.empty': 'Դեռ հոդվածներ չկան։',

    'agenda.title': 'Միջոցառումներ',
    'agenda.subtitle': 'Հայկական միջոցառումներ Շվեյցարիայում եւ աշխարհում',
    'agenda.switzerland': 'Շվեյցարիա',
    'agenda.world': 'Աշխարհ',
    'agenda.empty': 'Հայտարարված միջոցառումներ չկան։',
    'agenda.more': 'Տեսնել armenopole-ում',

    'social.title': 'Սոցիալական ցանցեր',
    'social.subtitle':
      'Երկու հոսք՝ Դօն Նարեկի կիսած արվեստը Facebook-ում և Instagram-ի ընտրանին՝ վերաշաղախված ամեն ժամ',

    'fb.title': 'Հայկական արվեստ',
    'fb.by': 'Դօն Նարեկի կողմից',
    'fb.subtitle': 'Վերջին 20 հրապարակումները՝ նկարներով',
    'fb.view': 'Դիտել հրապարակումը',
    'fb.fallback': 'Դիտել էջը Facebook-ում',

    'ig.title': 'Instagram',
    'ig.subtitle': 'Հայկական ոգեշնչման խճանկար՝ պատահական',
    'ig.strand': 'Հայկական խճանկար',
    'ig.strand.people': 'Հայկական դեմքեր',
    'ig.shuffle': 'Խառնել',
    'ig.visit': 'Դիտել պրոֆիլը',
    'ig.view': 'Դիտել Instagram-ում',

    'footer.built': 'Ստատիկ պատկեր · աղբյուրները կապված են իրենց կայքերին',
    'footer.write': 'Գրեք մեզ',
    'footer.sources': 'Աղբյուրներ',

    'sections.actualite': 'Լուրեր',
    'sections.societe': 'Հասարակություն',
    'sections.economie': 'Տնտեսություն',
    'sections.arts-et-culture': 'Արվեստ եւ մշակույթ',
    'sections.francophonie': 'Ֆրանսախոս Հայաստան',
    'sections.opinions': 'Կարծիքներ',
    'sections.region': 'Տարածաշրջան',
    'sections.diasporas': 'Սփյուռք',

    'armcats.politics': 'Քաղաքականություն',
    'armcats.society': 'Հասարակություն',
    'armcats.economics': 'Տնտեսություն',
    'armcats.analytics': 'Վերլուծություն',
    'armcats.world': 'Աշխարհ',
    'armcats.culture': 'Մշակույթ',
    'armcats.sport': 'Սպորտ',

    'namcats.actualites': 'Լուրեր',
    'namcats.sport': 'Սպորտ',
    'namcats.communaute': 'Համայնք',
    'namcats.culture': 'Մշակույթ',
    'namcats.lifestyle': 'Ապրելակերպ',
    'namcats.magazine': 'Ամսագրեր',

    'azkcats.armenie-artsakh': 'Հայաստան և Արցախ',
    'azkcats.communaute': 'Համայնք',
    'azkcats.divers': 'Զանազան',

    'aitcats.armenie': 'Հայաստան',
    'aitcats.art-culture': 'Արվեստ և մշակույթ',
    'aitcats.artsakh': 'Արցախ',
    'aitcats.diaspora': 'Սփյուռք',
    'aitcats.france': 'Ֆրանսիա',
    'aitcats.geopolitique': 'Աշխարհաքաղաքականություն',
    'aitcats.politique': 'Քաղաքականություն',
    'aitcats.un-autre-regard': 'Այլ հայացք',

    'browser.subtitle': 'Բոլոր բաժինները՝ ըստ աղբյուրի',
    'browser.armradio': 'Հայաստանի հանրային ռադիո',
    'browser.courrier': '«Կուրիեր դ’Էրեւան»',
    'browser.armenews': 'armenews.com',
    'browser.artzakank': 'Շվեյցարիայի հայերի արձագանք',
    'browser.armenieinfotv': 'armenieinfo.tv',
    'browser.armenpress': 'Արմենպրես',
    'apcats.fil': 'Հոսք',

    'radio.eyebrow': 'Երևան · 128 kbps',
    'radio.title': 'Ուղիղ եթեր',
    'radio.subtitle': 'Հայաստանի Հանրային Ռադիո՝ ուղիղ հեռարձակում',
    'radio.onair': 'Ուղիղ',
    'radio.tz': 'Երևան',
    'radio.play': 'Միացնել',
    'radio.pause': 'Դադարեցնել',
    'radio.loading': 'Միանում է հեռարձակմանը…',
    'radio.error': 'Հեռարձակումն անհասանելի է։',
    'radio.retry': 'Կրկնել',
    'radio.volume': 'Ձայն',
    'radio.station': 'Ալիք',
    'radio.st.public': 'Առաջին ծրագիր',
    'radio.st.im': 'Իմ ռադիո',
    'radio.st.arevik': 'Ռադիո Արևիկ',
    'radio.st.culture': 'Ռադիո Մշակույթ',
    'radio.st.mariam': 'Ռադիո Մարիամ',
    'radio.st.vov': 'Վանա ձայն',
    'radio.st.lav': 'Լավ Ռադիո',
    'radio.st.fama': 'Ռադիո Ֆամա',
    'radio.st.yerevannights': 'Yerevan Nights',
    'radio.st.gospel': 'Armenian Gospel Radio',
    'radio.st.yeraz': 'Radio Yeraz',
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
