// YouTube : table des chaînes et garde d'identité. Pur, sans réseau à
// l'import — la file d'attente et l'envoi s'ajoutent ici (tâche 9).

// Une chaîne de marque par langue, toutes sous le même compte Google.
export const YT_CHANNELS = {
  fr: 'UC6XuuuP2t57coFE6f4uqX9Q',
  en: 'UC6wp4LgAJIZKwCkHwbWEoXQ',
  hy: 'UCkDbtL2BscdI6iLTcjXlpHw',
  ru: 'UC7IB7SETN9YlUHShEbzAw8Q',
  de: 'UCsVZkaQ_qW8t5D3DkZl-n2A',
  it: 'UCU5wfH1iTa0lVKswZiol2eg',
  es: 'UCjvG5iFzxPKX_7u9t7-JCuQ',
}

export const YT_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
]

export const ytLangs = () => Object.keys(YT_CHANNELS)

// null si la chaîne obtenue est la bonne, sinon le message d'erreur.
export function checkChannel(expected, got) {
  if (expected === got) return null
  return `Mauvaise chaîne : attendue ${expected}, obtenue ${got || '(aucune)'}. Relancez et choisissez la bonne chaîne sur l'écran de consentement.`
}
