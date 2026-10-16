import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isFreeLicense } from '../scripts/lib/culture-license.mjs'

test('licences acceptées', () => {
  for (const ok of ['Public domain', 'PD-old', 'CC0', 'CC BY 2.0', 'CC BY-SA 4.0', 'CC BY-SA 3.0 de', 'cc-by-sa-4.0'])
    assert.equal(isFreeLicense(ok), true, ok)
})

test('licences refusées, et absence = refus', () => {
  for (const no of ['CC BY-NC 4.0', 'CC BY-NC-SA 2.0', 'CC BY-ND 3.0', 'GFDL', 'Fair use', '', null, undefined])
    assert.equal(isFreeLicense(no), false, String(no))
})
