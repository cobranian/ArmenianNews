import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agendaJsonLd } from '../src/jsonld.js'

const EVS = [
  { title: 'Soirée', url: 'https://ex.org/a', location: 'Genève', date: '2099-01-01T19:00:00.000Z' },
  { title: 'Passé', url: 'https://ex.org/b', location: 'Lyon', date: '2000-01-01T19:00:00.000Z' },
]

test('seuls les evenements a venir sont balises', () => {
  const bloc = JSON.parse(agendaJsonLd('fr', EVS))
  const noms = bloc.itemListElement.map((i) => i.item.name)
  assert.deepEqual(noms, ['Soirée'])
})

// Baliser une adresse que la donnee ne contient pas serait inventer un fait.
// Search Console signalera l'adresse manquante en AVERTISSEMENT non bloquant :
// c'est le comportement correct, pas un defaut a corriger.
test('le lieu se limite au texte reel, sans adresse inventee', () => {
  const item = JSON.parse(agendaJsonLd('fr', EVS)).itemListElement[0].item
  assert.equal(item.location['@type'], 'Place')
  assert.equal(item.location.name, 'Genève')
  assert.ok(!('address' in item.location), 'aucune adresse ne doit etre inventee')
})

test('aucune chaine ne peut fermer le script', () => {
  const out = agendaJsonLd('fr', [
    { title: '</script><script>x', url: 'https://ex.org/c', location: 'X', date: '2099-01-01T00:00:00.000Z' },
  ])
  assert.ok(!out.includes('</script'), 'le « < » doit etre echappe')
})

// La signature testable-sans-horloge : `maintenant` en troisieme parametre
// permet de fixer le present sans dependre de Date.now() ni du reseau.
test('maintenant est injectable et fixe la frontiere passe/a venir', () => {
  const fige = new Date('2050-06-15T00:00:00.000Z').getTime()
  const evs = [
    { title: 'Avant la borne', url: 'https://ex.org/d', location: 'Erevan', date: '2050-06-14T00:00:00.000Z' },
    { title: 'Apres la borne', url: 'https://ex.org/e', location: 'Erevan', date: '2050-06-16T00:00:00.000Z' },
  ]
  const bloc = JSON.parse(agendaJsonLd('fr', evs, fige))
  assert.deepEqual(
    bloc.itemListElement.map((i) => i.item.name),
    ['Apres la borne'],
  )
})

test('image absente : le champ image est omis, pas null', () => {
  const item = JSON.parse(
    agendaJsonLd('fr', [
      { title: 'Sans image', url: 'https://ex.org/f', location: 'Genève', date: '2099-01-01T00:00:00.000Z' },
    ]),
  ).itemListElement[0].item
  assert.ok(!('image' in item))
})

test('numberOfItems suit le compte des evenements a venir', () => {
  const bloc = JSON.parse(agendaJsonLd('fr', EVS))
  assert.equal(bloc.numberOfItems, 1)
})
