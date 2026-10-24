// Les modèles :free d'OpenRouter se retirent sans prévenir : un id mort reste
// dans une chaîne de replis sans rien casser, jusqu'au jour où le modèle de
// tête tombe aussi. RETIRED liste ceux qui ont répondu 404 ; aucune chaîne ne
// doit les contenir.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { modelChain } from '../scripts/lib/classify-rubrics.mjs'
import { briefModels } from '../scripts/lib/brief-generate.mjs'
import { resumeModels } from '../scripts/lib/agenda-resumes.mjs'
import { CULTURE_FALLBACK_MODELS } from '../scripts/lib/culture-llm.mjs'

const RETIRED = [
  'nvidia/nemotron-3-super-120b-a12b:free', // 404 « Provider returned error », 24 oct. 2026
]

test('aucune chaîne de modèles ne contient un modèle retiré', () => {
  const chains = {
    classement: modelChain(null),
    'brève fr': briefModels('fr', null),
    'brève hy': briefModels('hy', null),
    résumés: resumeModels(null),
    culture: CULTURE_FALLBACK_MODELS,
  }
  for (const [name, chain] of Object.entries(chains)) {
    for (const m of chain) assert.ok(!RETIRED.includes(m), `${name} : ${m} est retiré`)
    assert.ok(chain.length >= 2, `${name} : au moins un repli`)
  }
})
