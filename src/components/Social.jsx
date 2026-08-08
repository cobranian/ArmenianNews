import { useMemo, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import { Carousel } from './Carousel.jsx'
import { Lightbox } from './Lightbox.jsx'
import { Motif, hash, THEMES } from './motifs.jsx'
import fb from '../data/facebook.json'
import ig from '../data/instagram.json'
import feed from '../data/instagram-feed.json'

/* ------------------------------------------------------------------ *
 * Réseaux sociaux — one section, every strand on screen.
 *
 * Instagram and Facebook (Don Narek) answer the same question — "what is
 * the Armenian internet posting right now?" — so they share one section.
 * They sit as stacked shelves, the way the Agenda stacks Switzerland and
 * the world: nothing is hidden behind a tab, you scroll and you see them
 * all. Each shelf names its network in the mono eyebrow and its content
 * in the display title, because the network is the source, not the subject.
 *
 * Don't write the shelf COUNT here. It is not invariant — an Instagram
 * strand whose hourly draw is empty does not render at all (`if
 * (!posts.length) return null`), and neither does Facebook without posts.
 * This file already learned that lesson once, twenty lines below, about
 * calling `institutions` "the first strand".
 *
 * THE ORDER IS EDITORIAL: the Instagram strands come first, Don Narek's
 * wall closes the section. Instagram is redrawn every hour and is what the
 * section is for; the Facebook wall is a single curated author, so it reads
 * as the coda rather than the opening. Nothing computes this order — it is
 * the order these two blocks are written in, below.
 *
 * The shelves stay horizontal, swipeable carousels with ‹ › arrows — desktop
 * and mobile alike. What changed: a card no longer navigates away on click.
 * It is a framed "plate" (the peintres#movses mechanic) that lifts on hover
 * and OPENS A LIGHTBOX (./Lightbox.jsx) — an enlarged view that stays on the
 * site, with ‹ › to browse the whole strand and a link out to the real post.
 * The way to each Facebook post lives inside that lightbox (its own permalink);
 * the Instagram strand also carries its crawlable account chips.
 *
 * Neither network's official embed is used: the Facebook Page Plugin drags
 * in the whole FB chrome and Instagram's embed.js refuses to hydrate behind
 * ad-blockers and region locks, both leaving blank cells. Every curated post
 * instead renders as an on-brand card that ALWAYS paints. Images are bundled
 * at build time (src/data/fb/, src/data/ig/) so they never hotlink or expire;
 * a post with no image falls back to a deterministic Armenian motif — the
 * same motif the lightbox shows, so nothing comes up blank (./motifs.jsx).
 *
 * Cards carry no .reveal: inside a horizontally scrolling track, the cards to
 * the right of the fold never intersect the viewport, so a reveal-gated card
 * would stay invisible until swiped into view. The shelf itself reveals, which
 * is what News and Agenda do — the cards ride along.
 * ------------------------------------------------------------------ */

const FB_IMAGES = import.meta.glob('../data/fb/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const fbImg = Object.fromEntries(
  Object.entries(FB_IMAGES).map(([path, src]) => [path.split('/').pop(), src]),
)

// Les deux globs acceptent `{jpg,webp}` DÉFINITIVEMENT, pas seulement pendant la
// migration vers WebP : un `.jpg` qui survivrait à une conversion incomplète
// continue de s'afficher. Verrouiller sur `.webp` transformerait tout fichier
// oublié en tuile muette retombée sur son motif, sans message.
const IG_IMAGES = import.meta.glob('../data/ig/*.{jpg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const igImg = Object.fromEntries(
  Object.entries(IG_IMAGES).map(([path, src]) => [
    path.split('/').pop().replace(/\.(jpg|webp)$/, ''),
    src,
  ]),
)
const shortcode = (url) => url.match(/\/(?:p|reel|tv)\/([^/?]+)/)?.[1] || null

/* L'id de la photo de Don Narek lui-même, épinglée en tête du mur Facebook.
   Même valeur que `PINNED_ID` dans scripts/fb-scrape.mjs — les deux fichiers ne
   peuvent pas se partager la constante (l'un est un module de build Node, l'autre
   du JSX de navigateur), d'où le rappel de part et d'autre. */
const FB_PINNED_ID = 'dn-narek'

/* The expand glyph that wakes on hover — the plate's "click to enlarge" cue,
   and the textual "Agrandir" in the body carries the same intent for touch. */
function ZoomBadge() {
  return (
    <span className="card-zoom" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M15 3h6v6M21 3l-7 7M9 21H3v-6M3 21l7-7" />
      </svg>
    </span>
  )
}

/* Initials for the author monogram, e.g. "Don Narek" → "DN". */
function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '·'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/* A shelf title: the network above, in the wire face; what it carries below,
   in the display face. Facebook has an author, so it gets a byline. */
function StrandTitle({ network, name, by }) {
  return (
    <span className="strand">
      <span className="strand__net">{network}</span>
      <span className="strand__name">
        {name}
        {by && <em className="strand__by">{by}</em>}
      </span>
    </span>
  )
}

function FacebookCard({ post, author, cta, enlarge, img, onOpen }) {
  const seed = hash(post.id || post.url || author)
  const theme = THEMES[seed % THEMES.length]
  const [broken, setBroken] = useState(false)
  const showPhoto = img && !broken
  const by = post.author || author

  return (
    <button
      type="button"
      className="fb-card"
      onClick={onOpen}
      aria-label={`${enlarge} : ${by}`}
      style={{ '--c1': theme.c1, '--c2': theme.c2, '--ink': theme.ink }}
    >
      <div className={`fb-card__cover${showPhoto ? ' fb-card__cover--photo' : ''}`}>
        {showPhoto ? (
          <img
            className="fb-card__photo"
            loading="lazy"
            src={img}
            alt={by}
            onError={() => setBroken(true)}
          />
        ) : (
          <svg className="fb-card__motif" viewBox="0 0 100 100" aria-hidden="true">
            <Motif index={seed} />
          </svg>
        )}
        <ZoomBadge />
        <span className="fb-card__corner fb-card__corner--tl" aria-hidden="true" />
        <span className="fb-card__corner fb-card__corner--br" aria-hidden="true" />
      </div>
      <div className="fb-card__body">
        <span className="fb-card__mark" aria-hidden="true">
          {initials(by)}
        </span>
        <span className="fb-card__author">{by}</span>
        <span className="fb-card__cta">
          {cta} <span aria-hidden="true">→</span>
        </span>
      </div>
    </button>
  )
}

function InstagramCard({ url, handle, name, cta, enlarge, img, onOpen }) {
  const seed = hash(url)
  const theme = THEMES[seed % THEMES.length]
  const isReel = /\/reel\//.test(url)
  const [broken, setBroken] = useState(false)
  const showPhoto = img && !broken

  return (
    <button
      type="button"
      className="ig-card"
      onClick={onOpen}
      aria-label={`${enlarge} : @${handle}`}
      style={{ '--c1': theme.c1, '--c2': theme.c2, '--ink': theme.ink }}
    >
      <div className={`ig-card__cover${showPhoto ? ' ig-card__cover--photo' : ''}`}>
        {showPhoto ? (
          <img
            className="ig-card__photo"
            loading="lazy"
            src={img}
            alt={`@${handle} — ${name}`}
            onError={() => setBroken(true)}
          />
        ) : (
          <svg className="ig-card__motif" viewBox="0 0 100 100" aria-hidden="true">
            <Motif index={seed} />
          </svg>
        )}
        <ZoomBadge />
        <span className="ig-card__kind">{isReel ? '▷ Reel' : '◻ Post'}</span>
        <span className="ig-card__corner ig-card__corner--tl" aria-hidden="true" />
        <span className="ig-card__corner ig-card__corner--br" aria-hidden="true" />
      </div>
      <div className="ig-card__body">
        <div className="ig-card__handle">
          <span aria-hidden="true">◎</span> @{handle}
        </div>
        <div className="ig-card__name">{name}</div>
        <div className="ig-card__cta">
          {cta} <span aria-hidden="true">→</span>
        </div>
      </div>
    </button>
  )
}

/* Les pastilles de comptes : des portes d'entrée vers les profils, et le repli
 * d'un compte dont aucun post n'a encore été récolté — sans elles, ce compte
 * n'existerait nulle part sur le site.
 *
 * Repliées par défaut : à 25 comptes, le rang repoussait le brin suivant très
 * bas. Le motif est celui des douze stations (`.radio__stations-toggle`), à une
 * différence près — la bascule des stations n'existe que sous 640px, parce que
 * la mise en page dépliée tient d'elle-même sur grand écran. 25 pastilles
 * encombrent autant un écran large qu'un téléphone.
 *
 * REPLIÉ = `hidden`, PAS une opacité. C'est l'inverse exact du piège du
 * tambour, où il fallait `opacity: 0` pour garder des onglets focusables dans
 * l'arbre d'accessibilité : ici on veut que ces liens SORTENT du parcours
 * clavier tant qu'ils sont repliés. Et `hidden` les laisse dans le HTML
 * prérendu, donc les liens sortants restent lisibles par les crawlers.
 *
 * Le nombre entre par un gabarit `{n}` — comme `radio.stations.all`, et pour
 * une raison de plus : les quatre brins n'ont pas le même compte, donc un
 * nombre écrit dans la chaîne serait faux trois fois sur quatre. Il est mis
 * ENTRE PARENTHÈSES et non dans la phrase, ce que le motif des stations ne fait
 * pas : là-bas le nombre est fixe (12) et le russe s'accorde une fois pour
 * toutes ; ici il vaut 10, 6, 5 ou 4 et le russe change de forme avec lui
 * (« 4 аккаунта » mais « 10 аккаунтов »). La parenthèse met le nombre hors de
 * la grammaire. */
function AccountChips({ id, accounts, t }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ig-accounts">
      <button
        type="button"
        className="ig-accounts__toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        {open
          ? t('ig.accounts.less')
          : t('ig.accounts.all').replace('{n}', accounts.length)}
        <span aria-hidden="true">{open ? ' ⌃' : ' ⌄'}</span>
      </button>
      <div className="ig-accounts__list" id={id} hidden={!open}>
        {accounts.map((acc) => (
          <a
            key={acc.handle}
            className="ig-chip"
            href={acc.url}
            rel="noopener noreferrer"
            title={t('ig.visit')}
          >
            <span aria-hidden="true">◎</span> @{acc.handle}
          </a>
        ))}
      </div>
    </div>
  )
}

export function Social() {
  const { t } = useI18n()

  // Which set is enlarged, and where in it. null = closed.
  const [box, setBox] = useState(null)

  // Tout ce que le fichier contient, dans son ordre — la photo de Don Narek
  // lui-même est déjà épinglée en tête par le scraper.
  //
  // PLUS DE PLAFOND ICI, et c'est le correctif : il y en avait un à 40, censé
  // « correspondre à WANT dans fb-scrape.mjs pour ne jamais masquer en silence
  // ce que le scrape a récolté ». Le passage du scrape à 80 a fait exactement
  // cela — la moitié du mur disparaissait, sans erreur ni avertissement. Un
  // plafond écrit à deux endroits finit toujours par diverger ; celui du
  // scraper suffit, il décide déjà de ce qui entre dans le fichier.
  const fbPosts = useMemo(
    () => (fb.posts || []).map((p) => ({ ...p, img: fbImg[p.image] || null })),
    [],
  )

  // Use the hourly-baked random selection; fall back to flattening the curated
  // accounts (e.g. before the first snapshot exists).
  const igPosts = useMemo(() => {
    const base =
      feed.posts && feed.posts.length
        ? feed.posts
        : ig.accounts.flatMap((acc) =>
            (acc.posts || []).map((p) => ({
              url: p.url,
              handle: acc.handle,
              name: acc.name,
              group: acc.group || 'institutions',
            })),
          )
    return base.map((p) => ({ ...p, img: igImg[shortcode(p.url)] || null }))
  }, [])

  // The lightbox item for a Facebook post — its enlarged view plus the way out.
  //
  // Sauf pour la photo épinglée : c'est le portrait de Don Narek lui-même, la
  // signature du mur, pas une publication à aller lire. Elle part donc SANS
  // `href`, et la lightbox n'affiche alors aucun bouton (voir Lightbox.jsx) —
  // toutes les autres cartes gardent le leur. L'id `dn-narek` est stable par
  // construction (`PINNED_ID` dans scripts/fb-scrape.mjs) : il est tenu hors de
  // la numérotation `dn-NN` précisément pour rester reconnaissable d'une
  // récolte à l'autre.
  const fbItems = useMemo(
    () =>
      fbPosts.map((p) => {
        const seed = hash(p.id || p.url || fb.page)
        const theme = THEMES[seed % THEMES.length]
        const pinned = p.id === FB_PINNED_ID
        return {
          img: p.img,
          alt: p.author || fb.page,
          title: p.author || fb.page,
          sub: '',
          href: pinned ? null : p.url,
          cta: t('fb.view'),
          seed,
          c1: theme.c1,
          c2: theme.c2,
          ink: theme.ink,
        }
      }),
    [fbPosts, t],
  )

  // The wall reads as five strands: those who turn Armenian work into a
  // catalogue, the community and the institutions that carry Armenian life,
  // the people who are its face, the studios where the work is made, and the
  // land itself. Each account declares its own strand in instagram.json.
  //
  // AN UNLABELLED ACCOUNT LANDS IN `institutions`, WHICH IS NO LONGER FIRST.
  // That fallback is spelled out twice — here and in
  // scripts/sources/instagram.mjs — and it names a strand, not a position, so
  // reordering this array does not move it. Say the name: a comment that
  // called it "the first strand" was true only by accident, and went silently
  // false the day `createurs` took the lead.
  //
  // The order is editorial, not derived: makers open the wall because that is
  // what this site is for. Nothing computes it, so nothing will restore it if
  // someone sorts this array.
  //
  // One entry per line: test/instagram-strands.test.mjs reads this array as
  // text (Node cannot import JSX), and a wrapped entry fails it loudly.
  const igStrands = [
    { id: 'instagram-createurs', group: 'createurs', title: t('ig.strand.creators') },
    { id: 'instagram', group: 'institutions', title: t('ig.strand') },
    { id: 'instagram-visages', group: 'personnalites', title: t('ig.strand.people') },
    { id: 'instagram-ateliers', group: 'creation', title: t('ig.strand.studio') },
    { id: 'instagram-terres', group: 'terre', title: t('ig.strand.land') },
  ]
  const inGroup = (group) => (p) => (p.group || 'institutions') === group

  return (
    <section className="section" id="reseaux">
      <div className="container">
        <SectionHead
          eyebrow="Instagram · Facebook"
          title={t('social.title')}
          subtitle={t('social.subtitle')}
        />

        <div className="social">
          {/* The networks were linked to as #facebook and #instagram for months.
              Those anchors now land on their own strand, not just the section.
              Moving Facebook last did not move #facebook: the anchor rides on
              the strand, not on a position in this list. */}
          {igStrands.map(({ id, group, title }) => {
            const posts = igPosts.filter(inGroup(group))
            if (!posts.length) return null
            const items = posts.map((p) => {
              const seed = hash(p.url)
              const theme = THEMES[seed % THEMES.length]
              return {
                img: p.img,
                alt: `@${p.handle} — ${p.name}`,
                title: p.name,
                sub: `Instagram · @${p.handle}`,
                href: p.url,
                cta: t('ig.view'),
                seed,
                c1: theme.c1,
                c2: theme.c2,
                ink: theme.ink,
              }
            })
            return (
            <div className="social__strand" id={id} key={id}>
              <Carousel
                label="Instagram"
                title={<StrandTitle network="Instagram" name={title} />}
              >
                {posts.map((p, i) => (
                  <InstagramCard
                    key={p.url}
                    url={p.url}
                    handle={p.handle}
                    name={p.name}
                    img={p.img}
                    cta={t('ig.zoom')}
                    enlarge={t('social.enlarge')}
                    onOpen={() => setBox({ items, index: i })}
                  />
                ))}
              </Carousel>

              <AccountChips
                id={`${id}-comptes`}
                accounts={ig.accounts.filter((acc) => inGroup(group)(acc))}
                t={t}
              />
            </div>
            )
          })}

          {fbPosts.length > 0 && (
            <div className="social__strand" id="facebook">
              <Carousel
                label={t('fb.title')}
                title={
                  <StrandTitle network="Facebook" name={t('fb.title')} by={t('fb.by')} />
                }
              >
                {fbPosts.map((p, i) => (
                  <FacebookCard
                    key={p.id || p.url}
                    post={p}
                    author={fb.page}
                    img={p.img}
                    cta={t('fb.zoom')}
                    enlarge={t('social.enlarge')}
                    onOpen={() => setBox({ items: fbItems, index: i })}
                  />
                ))}
              </Carousel>
            </div>
          )}
        </div>
      </div>

      {box && (
        <Lightbox
          items={box.items}
          startIndex={box.index}
          onClose={() => setBox(null)}
        />
      )}
    </section>
  )
}
