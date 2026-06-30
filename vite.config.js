import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages project sites the app is served from /<repo>/.
// Override with BASE_PATH env (e.g. '/' for a custom domain or user page).
const base = process.env.BASE_PATH ?? '/ArmenianNews/'

export default defineConfig({
  base,
  plugins: [react()],
})
