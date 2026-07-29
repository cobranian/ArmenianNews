import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  HY_MONTHS_GENITIVE,
  HY_MONTHS_ABBR,
  HY_WEEKDAYS_ABBR,
  hyLongDate,
  hyMonthAbbr,
  hyWeekdayTime,
} from '../src/hyDate.js'

// Les dates arméniennes sont écrites EN DUR (src/hyDate.js explique pourquoi :
// l'ICU de Chrome n'a pas les données de date arméniennes et retombe sur la
// langue du lecteur). Une table en dur sans garde pourrit en silence — une
// lettre de travers dans « սեպտեմբերի » ne casse ni le build, ni le lint, ni
// aucune page : elle affiche simplement un mois mal orthographié un mois par an.
//
// Ce test confronte la table au CLDR. Node embarque l'ICU COMPLET, donc `Intl`
// y rend un arménien correct — c'est justement ce qui rendait le bug d'origine
// invisible côté Node, et c'est ce qui en fait ici une référence utilisable.
// L'asymétrie est le sujet : Node sait, le navigateur non.
//
// Si un jour Node est bâti sans ICU complet, `Intl` cesserait d'être une
// référence et le test se tairait plutôt que de mentir — d'où le garde-fou.
const ICU_HAS_ARMENIAN =
  new Intl.DateTimeFormat('hy-AM', { month: 'long' }).resolvedOptions().locale.startsWith('hy')

const at = (m, d = 15) => new Date(2026, m, d, 14, 30)

test('les trois tables arméniennes ont la bonne cardinalité', () => {
  assert.equal(HY_MONTHS_GENITIVE.length, 12)
  assert.equal(HY_MONTHS_ABBR.length, 12)
  assert.equal(HY_WEEKDAYS_ABBR.length, 7)
  for (const table of [HY_MONTHS_GENITIVE, HY_MONTHS_ABBR, HY_WEEKDAYS_ABBR]) {
    for (const s of table) {
      // Toutes les chaînes sont en écriture arménienne (U+0530–058F) et non
      // vides : un trou dans la table rendrait « undefined » dans la page.
      assert.match(s, /^[԰-֏]+$/, `« ${s} » n'est pas de l'arménien pur`)
    }
  }
})

test('les mois abrégés ne portent pas de point final', () => {
  // Le français abrège « juil. », l'arménien non. Le retrait du point vit dans
  // i18n.jsx pour les autres langues ; si un point se glissait ici, il serait
  // retiré deux fois côté français et jamais côté arménien.
  for (const m of HY_MONTHS_ABBR) assert.ok(!m.includes('.'), `« ${m} » porte un point`)
})

test('le dimanche est bien à l’index 0 des jours', () => {
  // Les tables de jours sont indexées sur Date.getDay(). Le 1ᵉʳ février 2026 est
  // un dimanche : si la table était décalée d'un cran (lundi en tête, l'autre
  // convention courante), chaque événement de l'agenda arménien afficherait le
  // mauvais jour de la semaine — décalage constant, donc plausible à l'œil.
  const dimanche = new Date(2026, 1, 1)
  assert.equal(dimanche.getDay(), 0)
  assert.equal(hyWeekdayTime(dimanche).split(',')[0], HY_WEEKDAYS_ABBR[0])
})

test('hyLongDate reproduit exactement le motif long du CLDR arménien', (t) => {
  if (!ICU_HAS_ARMENIAN) return t.skip('cette version de Node est sans ICU arménien')
  const fmt = new Intl.DateTimeFormat('hy-AM', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  for (let m = 0; m < 12; m++) {
    const d = at(m)
    assert.equal(hyLongDate(d), fmt.format(d), `mois ${m + 1}`)
  }
})

test('hyMonthAbbr et hyWeekdayTime reproduisent les abréviations du CLDR', (t) => {
  if (!ICU_HAS_ARMENIAN) return t.skip('cette version de Node est sans ICU arménien')
  const mois = new Intl.DateTimeFormat('hy-AM', { month: 'short' })
  for (let m = 0; m < 12; m++) {
    const d = at(m)
    assert.equal(hyMonthAbbr(d), mois.format(d), `mois abrégé ${m + 1}`)
  }
  const jour = new Intl.DateTimeFormat('hy-AM', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  // Sept jours consécutifs : couvre les sept entrées de la table.
  for (let i = 0; i < 7; i++) {
    const d = at(1, 1 + i)
    assert.equal(hyWeekdayTime(d), jour.format(d), `jour ${i}`)
  }
})
