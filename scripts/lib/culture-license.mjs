// scripts/lib/culture-license.mjs
//
// Les licences d'image Commons que le site accepte : domaine public, CC0,
// CC BY et CC BY-SA, toutes versions. Refusées : NC (le site vise la
// publicité, donc un usage commercial), ND (la carte de partage est un
// recadrage, donc une œuvre dérivée), et tout ce qui n'est pas reconnu.
// Une licence absente vaut un refus.
export function isFreeLicense(name) {
  const n = String(name ?? '').trim().toLowerCase()
  if (!n) return false
  if (/(^|[^a-z])(nc|nd)([^a-z]|$)|non-?commercial|no-?deriv|fair use/.test(n)) return false
  return /^(public domain|pd([^a-z]|$)|cc0|cc[- ]by(-sa)?[- ]\d)/.test(n)
}
