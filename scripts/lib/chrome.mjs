import { existsSync } from 'node:fs'

/**
 * Path to an installed Chrome/Edge, or undefined if none is found.
 *
 * puppeteer-core ships no browser of its own, so both the screenshot and the
 * prerender need one that is already on the machine. First existing browser
 * wins; the env overrides take precedence — that is how CI passes the Chrome
 * that browser-actions/setup-chrome installed.
 *
 * Returns rather than exits: the caller decides whether a missing browser is
 * fatal.
 */
export function findChrome() {
  return [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ]
    .filter(Boolean)
    .find((p) => existsSync(p))
}
