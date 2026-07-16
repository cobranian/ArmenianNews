import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// The repo runs code in three places, and each needs different globals:
// the app in a browser, the scrapers in Node, and theme-init.js in a browser
// before any module loads. One flat config per world, narrowest last.
export default [
  // .cache holds the logged-in Chrome profiles the manual fb/ig scrapes drive —
  // someone else's extension code, not ours.
  { ignores: ['dist/**', 'src/data/**', '.firebase/**', '.cache/**'] },

  // The app: browser + React.
  {
    files: ['src/**/*.{js,jsx}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Core no-unused-vars cannot see that <Carousel /> uses `Carousel`, and
      // would have us delete every component import in the app. These two rules
      // are what teach it to read JSX.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // The scrapers and build scripts: Node.
  //
  // Browser globals are in scope too, and that is not sloppiness: the Puppeteer
  // scripts pass callbacks to page.evaluate(), whose bodies are serialised and
  // run inside the browser. `document` and `window` there are real. ESLint reads
  // them as ordinary Node code and cannot tell the difference, so the choice is
  // between these globals and scattering eslint-disable over every evaluate().
  {
    files: ['scripts/**/*.mjs', 'vite.config.js', 'eslint.config.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: js.configs.recommended.rules,
  },

  // theme-init.js runs from a plain <script> tag before the bundle, to set the
  // saved day/night theme before first paint. Not a module — no import/export.
  {
    files: ['public/theme-init.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: globals.browser,
    },
    rules: js.configs.recommended.rules,
  },
]
